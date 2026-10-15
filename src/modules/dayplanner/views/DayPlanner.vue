<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLiveQuery, useOnline } from '@/core/composables'
import { todayIso } from '@/core/dates'
import { formatDate, formatDayShort } from '@/core/format'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import { DueReminders } from '@/modules/termine/public'
import { WarningBanner } from '@/modules/unwetter/public'
import { CATEGORY, PRIORITY, SETTING, activityRepository, type Activity } from '@/modules/activity/public'
import { describeCode, fetchDailyForecast, type Place } from '@/services/weather'
import { weatherRepository } from '../repository'
import { forecastAvailableFrom, initialDay, inForecastRange, isRainy, isStale, planDay, tripDates } from '../logic'
import type { WeatherCache } from '../types'
import PlaceSearch from '../components/PlaceSearch.vue'

const props = defineProps<{ tripId: string }>()
const route = useRoute()
const router = useRouter()
const online = useOnline()

const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const activities = useLiveQuery(() => activityRepository.listByTrip(props.tripId), [] as Activity[])
const cache = useLiveQuery(() => weatherRepository.get(props.tripId), undefined as WeatherCache | undefined)

const day = ref('')
const changingPlace = ref(false)
const loadingWeather = ref(false)
const weatherError = ref('')
const showAllSuggestions = ref(false)

const dates = computed(() => (trip.value ? tripDates(trip.value.startDate, trip.value.endDate) : []))
const weatherByDate = computed(() => new Map((cache.value?.days ?? []).map((d) => [d.date, d])))
const weather = computed(() => weatherByDate.value.get(day.value))
const plan = computed(() => (day.value ? planDay(day.value, activities.value, weather.value) : null))
const visibleSuggestions = computed(() => {
  const all = plan.value?.suggestions ?? []
  return showAllSuggestions.value ? all : all.slice(0, 5)
})

// Tag aus der Adresse (?tag=2026-07-03) oder sinnvoller Start
watch(
  [trip, () => route.query.tag],
  () => {
    if (!trip.value) return
    const q = typeof route.query.tag === 'string' ? route.query.tag : ''
    day.value = dates.value.includes(q) ? q : day.value && dates.value.includes(day.value) ? day.value : initialDay(trip.value.startDate, trip.value.endDate)
  },
  { immediate: true }
)

function selectDay(d: string) {
  router.replace({ query: { ...route.query, tag: d } })
}

async function loadWeather(place: Place) {
  loadingWeather.value = true
  weatherError.value = ''
  try {
    const days = await fetchDailyForecast(place.latitude, place.longitude)
    await weatherRepository.put({ tripId: props.tripId, place: { ...place }, fetchedAt: new Date().toISOString(), days })
    changingPlace.value = false
  } catch (e) {
    weatherError.value = online.value ? (e as Error).message : 'Offline – es wird die zuletzt geladene Vorhersage gezeigt.'
  } finally {
    loadingWeather.value = false
  }
}

// Beim Öffnen automatisch aktualisieren, wenn veraltet und online
onMounted(async () => {
  const c = await weatherRepository.get(props.tripId)
  if (c && isStale(c.fetchedAt) && navigator.onLine) loadWeather(c.place)
})

const ageText = computed(() => {
  // Ohne Abrufzeit (Ort gesetzt, Vorhersage noch nicht geladen – z. B. Beispielreise) kein Alter
  if (!cache.value?.fetchedAt) return ''
  const h = Math.round((Date.now() - Date.parse(cache.value.fetchedAt)) / 3_600_000)
  return h < 1 ? 'gerade eben' : h < 24 ? `vor ${h} Std.` : `vor ${Math.round(h / 24)} Tagen`
})

async function planIt(a: Activity) {
  await activityRepository.setPlannedDate(a.id, day.value)
}
async function unplan(a: Activity) {
  await activityRepository.setPlannedDate(a.id, '')
}
async function moveTo(a: Activity, target: string) {
  await activityRepository.setPlannedDate(a.id, target)
}
async function toggleDone(a: Activity) {
  await activityRepository.setStatus(a.id, a.status === 'erledigt' ? 'geplant' : 'erledigt')
}
async function swap(a: Activity, alt: Activity) {
  await activityRepository.setPlannedDate(a.id, '')
  await activityRepository.setPlannedDate(alt.id, day.value)
}

const plannedCountByDate = computed(() => {
  const m = new Map<string, number>()
  for (const a of activities.value) if (a.plannedDate && a.status !== 'verworfen') m.set(a.plannedDate, (m.get(a.plannedDate) ?? 0) + 1)
  return m
})
</script>

<template>
  <TripContextHeader :trip-id="tripId" title="Tagesplaner" />
  <DueReminders :trip-id="tripId" />
  <WarningBanner :trip-id="tripId" :day="day" />

  <!-- Tage der Reise -->
  <div class="day-strip d-flex gap-2 overflow-auto pb-2 mb-3">
    <button v-for="d in dates" :key="d" type="button" class="btn day-chip flex-none"
            :class="d === day ? 'btn-primary' : 'btn-outline-secondary'" @click="selectDay(d)">
      <div class="small">{{ formatDayShort(d) }}<span v-if="d === todayIso()"> · heute</span></div>
      <div v-if="weatherByDate.get(d)" class="fw-semibold">
        <i :class="`bi bi-${describeCode(weatherByDate.get(d)!.code).icon}`" aria-hidden="true"></i>
        {{ Math.round(weatherByDate.get(d)!.tempMax) }}°
      </div>
      <div v-else class="small opacity-50">–</div>
      <span v-if="plannedCountByDate.get(d)" class="badge rounded-pill" :class="d === day ? 'text-bg-light' : 'text-bg-primary'">
        {{ plannedCountByDate.get(d) }}
      </span>
    </button>
  </div>

  <!-- Wetter -->
  <section class="card mb-3">
    <div class="card-body">
      <template v-if="!cache || changingPlace">
        <h2 class="h6"><i class="bi bi-geo-alt me-1" aria-hidden="true"></i>Ort für die Wettervorhersage</h2>
        <PlaceSearch :initial-query="cache?.place.name ?? trip?.destination" @select="loadWeather" />
        <div v-if="loadingWeather" class="small mt-2"><span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Lade Vorhersage …</div>
        <button v-if="cache" type="button" class="btn btn-link btn-sm px-0 mt-2" @click="changingPlace = false">Abbrechen</button>
      </template>

      <template v-else>
        <div v-if="weather" class="d-flex align-items-center gap-3">
          <i :class="`bi bi-${describeCode(weather.code).icon} display-5 text-primary`" aria-hidden="true"></i>
          <div class="flex-grow-1">
            <div class="fw-semibold">{{ describeCode(weather.code).label }}, {{ Math.round(weather.tempMin) }}–{{ Math.round(weather.tempMax) }} °C</div>
            <div class="small text-body-secondary">
              <i class="bi bi-umbrella me-1" aria-hidden="true"></i>
              {{ weather.precipitationProbability ?? '–' }} % · {{ weather.precipitation.toFixed(1) }} mm
              <template v-if="weather.windMax !== null"> · <i class="bi bi-wind" aria-hidden="true"></i> {{ Math.round(weather.windMax) }} km/h</template>
            </div>
            <span v-if="isRainy(weather)" class="badge text-bg-info mt-1">Regentag – Drinnen-Ideen werden bevorzugt</span>
          </div>
        </div>
        <div v-else class="small text-body-secondary">
          <i class="bi bi-calendar2-week me-1" aria-hidden="true"></i>
          <template v-if="!inForecastRange(day)">
            Vorhersage für {{ formatDate(day) }} gibt es ab {{ formatDate(forecastAvailableFrom(day)) }}.
          </template>
          <template v-else>Für diesen Tag liegt noch keine Vorhersage vor – bitte aktualisieren.</template>
        </div>

        <div class="d-flex align-items-center gap-2 small text-body-secondary mt-2 flex-wrap">
          <span><i class="bi bi-geo-alt" aria-hidden="true"></i> {{ cache.place.name }}</span>
          <span>· Stand {{ ageText }}</span>
          <button type="button" class="btn btn-sm btn-link p-0" :disabled="!online || loadingWeather" @click="loadWeather(cache.place)">
            <i class="bi bi-arrow-clockwise" :class="{ spin: loadingWeather }" aria-hidden="true"></i> aktualisieren
          </button>
          <button type="button" class="btn btn-sm btn-link p-0" @click="changingPlace = true">Ort ändern</button>
        </div>
      </template>
      <div v-if="weatherError" class="small text-warning-emphasis mt-2">{{ weatherError }}</div>
    </div>
  </section>

  <template v-if="plan">
    <div v-for="w in plan.dayWarnings" :key="w" class="alert alert-warning py-2 small">
      <i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>{{ w }}
    </div>

    <!-- Geplant -->
    <h2 class="h6 text-body-secondary d-flex justify-content-between">
      <span>Geplant am {{ formatDayShort(day) }}</span>
      <span v-if="plan.plannedHours">{{ plan.plannedHours }} Std.</span>
    </h2>
    <p v-if="plan.planned.length === 0" class="small text-body-secondary">Noch nichts geplant – unten passende Vorschläge.</p>
    <ul class="list-group mb-4">
      <li v-for="p in plan.planned" :key="p.activity.id" class="list-group-item">
        <div class="d-flex gap-2 align-items-start">
          <button type="button" class="btn btn-sm flex-none" :class="p.activity.status === 'erledigt' ? 'btn-success' : 'btn-outline-success'"
                  :aria-label="p.activity.status === 'erledigt' ? 'Nicht erledigt' : 'Erledigt'" @click="toggleDone(p.activity)">
            <i class="bi bi-check-lg" aria-hidden="true"></i>
          </button>
          <div class="flex-grow-1 min-w-0">
            <RouterLink :to="`/trip/${tripId}/unternehmungen/${p.activity.id}`" class="fw-semibold text-body text-decoration-none"
                        :class="{ 'text-decoration-line-through text-body-secondary': p.activity.status === 'erledigt' }">
              <i :class="`bi bi-${CATEGORY[p.activity.category].icon} text-primary me-1`" aria-hidden="true"></i>{{ p.activity.title }}
            </RouterLink>
            <div class="small text-body-secondary">
              {{ SETTING[p.activity.setting].label }}
              <template v-if="p.activity.durationHours"> · {{ p.activity.durationHours }} Std.</template>
              <template v-if="p.activity.openingHours"> · {{ p.activity.openingHours }}</template>
            </div>
            <div v-for="w in p.warnings" :key="w" class="small text-danger">
              <i class="bi bi-exclamation-circle me-1" aria-hidden="true"></i>{{ w }}
            </div>
            <div v-if="p.alternative" class="small mt-1">
              Alternative: <strong>{{ p.alternative.title }}</strong> (drinnen)
              <button type="button" class="btn btn-sm btn-outline-primary py-0 ms-1" @click="swap(p.activity, p.alternative)">tauschen</button>
            </div>
          </div>
          <div class="dropdown flex-none">
            <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="dropdown" aria-label="Verschieben">
              <i class="bi bi-calendar2-range" aria-hidden="true"></i>
            </button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li><h6 class="dropdown-header">Verschieben auf</h6></li>
              <li v-for="d in dates.filter((x) => x !== day)" :key="d">
                <button class="dropdown-item" @click="moveTo(p.activity, d)">
                  {{ formatDayShort(d) }}
                  <i v-if="weatherByDate.get(d)" :class="`bi bi-${describeCode(weatherByDate.get(d)!.code).icon} ms-1`" aria-hidden="true"></i>
                </button>
              </li>
              <li><hr class="dropdown-divider" /></li>
              <li><button class="dropdown-item" @click="unplan(p.activity)">Zurück zu den Ideen</button></li>
            </ul>
          </div>
        </div>
      </li>
    </ul>

    <!-- Vorschläge -->
    <h2 class="h6 text-body-secondary">Vorschläge für diesen Tag</h2>
    <p v-if="plan.suggestions.length === 0" class="small text-body-secondary">
      Keine offenen Ideen.
      <RouterLink :to="`/trip/${tripId}/unternehmungen/neu`">Unternehmung hinzufügen</RouterLink>
    </p>
    <div class="vstack gap-2 mb-3">
      <div v-for="s in visibleSuggestions" :key="s.activity.id" class="card" :class="{ 'opacity-75': s.score < 0 }">
        <div class="card-body py-2 d-flex gap-2 align-items-start">
          <div class="flex-grow-1 min-w-0">
            <div class="fw-semibold">
              <i :class="`bi bi-${CATEGORY[s.activity.category].icon} text-primary me-1`" aria-hidden="true"></i>{{ s.activity.title }}
            </div>
            <div class="small text-body-secondary">
              {{ PRIORITY[s.activity.priority] }} · {{ SETTING[s.activity.setting].label }}
              <template v-if="s.activity.durationHours"> · {{ s.activity.durationHours }} Std.</template>
            </div>
            <div class="d-flex flex-wrap gap-1 mt-1">
              <span v-for="r in s.reasons" :key="r" class="badge"
                    :class="r.includes('ungünstig') ? 'text-bg-warning' : 'text-bg-light border'">{{ r }}</span>
              <span v-for="n in s.notes" :key="n" class="badge text-bg-warning">{{ n }}</span>
            </div>
          </div>
          <button type="button" class="btn btn-sm btn-primary flex-none" @click="planIt(s.activity)">
            <i class="bi bi-plus-lg" aria-hidden="true"></i> Einplanen
          </button>
        </div>
      </div>
    </div>
    <button v-if="plan.suggestions.length > 5" type="button" class="btn btn-link btn-sm px-0 mb-3" @click="showAllSuggestions = !showAllSuggestions">
      {{ showAllSuggestions ? 'Weniger zeigen' : `Alle ${plan.suggestions.length} Vorschläge zeigen` }}
    </button>

    <details v-if="plan.closed.length" class="small text-body-secondary mb-3">
      <summary>{{ plan.closed.length }} an diesem Tag geschlossen</summary>
      <ul class="mb-0 mt-1">
        <li v-for="c in plan.closed" :key="c.activity.id">{{ c.activity.title }} – {{ c.reason }}</li>
      </ul>
    </details>
  </template>

  <p class="small text-body-secondary border-top pt-2">
    Wetterdaten: <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">Open-Meteo.com</a> (CC BY 4.0).
    Öffnungszeiten werden aus deinem Text erkannt, z. B. „Di–So 10–18“.
  </p>
</template>

<style scoped>
.day-chip {
  min-width: 5.5rem;
  line-height: 1.2;
  position: relative;
}
.day-chip .badge {
  position: absolute;
  top: -0.4rem;
  right: -0.4rem;
}
.day-strip {
  scrollbar-width: thin;
  padding-top: 0.5rem;
}
.flex-none {
  flex: none;
}
.min-w-0 {
  min-width: 0;
}
.spin {
  display: inline-block;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
