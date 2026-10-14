<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useLiveQuery, useOnline } from '@/core/composables'
import { countryName, flag } from '@/core/countries'
import { getMeta } from '@/core/meta'
import { pushState } from '@/core/push'
import { syncState } from '@/core/sync/engine'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import { checkTrip, watchOf, NO_SERVER } from '../api'
import { inWatchWindow, isActiveNow, otherWarnings, period, relevantWarnings, settingsOf, toggleRegion } from '../logic'
import { todayIso } from '@/core/dates'
import { LEVELS, MATCH_LABELS, SOURCE_URL, TYPE_ICONS, type AlertScope, type WarningCache, type Watch, type WeatherWarning } from '../types'

const props = defineProps<{ tripId: string }>()
const online = useOnline()
const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const cache = useLiveQuery(() => getMeta<WarningCache | null>(`unwetter.${props.tripId}`, null), null as WarningCache | null)
const watch = ref<Watch | null>(null)
const busy = ref(false)
const error = ref('')

const countries = computed(() => trip.value?.countries ?? [])
const settings = computed(() => (trip.value ? settingsOf(trip.value) : settingsOf({})))
const relevant = computed(() => relevantWarnings(cache.value))
const others = computed(() => otherWarnings(cache.value))
const hasServer = computed(() => syncState.configured)

async function refresh() {
  error.value = ''
  busy.value = true
  try {
    await checkTrip(props.tripId)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

onMounted(async () => {
  const t = await tripRepository.get(props.tripId)
  if (!t) return
  watch.value = await watchOf(t)
  const c = await getMeta<WarningCache | null>(`unwetter.${props.tripId}`, null)
  const stale = !c || Date.now() - Date.parse(c.checkedAt) > 10 * 60_000
  if (t.countries?.length && settingsOf(t).scope !== 'aus' && hasServer.value && online.value && stale) await refresh()
})

async function setScope(scope: AlertScope) {
  if (!trip.value || settings.value.scope === scope) return
  await tripRepository.setWeatherAlerts(props.tripId, { ...settings.value, scope })
  watch.value = await watchOf({ ...trip.value, weatherAlerts: { ...settings.value, scope } })
  if (scope !== 'aus' && hasServer.value && online.value) await refresh()
}

async function toggle(code: string, name: string) {
  if (!trip.value) return
  const next = toggleRegion(settings.value, code, name)
  await tripRepository.setWeatherAlerts(props.tripId, next)
  watch.value = await watchOf({ ...trip.value, weatherAlerts: next })
  if (hasServer.value && online.value) await refresh()
}

const watched = (code: string) => settings.value.regions.includes(code)
/** Erste Kennung je Gebiet (EMMA_ID) – zum Beobachten */
const areaCodes = (w: WeatherWarning) => w.areas.filter((a) => a.codes.length).map((a) => ({ code: a.codes[0], name: a.name }))
const level = (n: number) => LEVELS[n] ?? LEVELS[2]
const icon = (w: WeatherWarning) => TYPE_ICONS[w.type] ?? 'exclamation-triangle'
const when = (iso: string) => (iso ? new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '')
const soon = computed(() => (trip.value ? inWatchWindow(trip.value, todayIso()) : false))
</script>

<template>
  <TripContextHeader :trip-id="tripId" title="Unwetterwarnungen" />

  <div v-if="trip && !countries.length" class="alert alert-info">
    Noch kein Zielland angegeben. <RouterLink :to="`/trip/${tripId}/bearbeiten`">Reise bearbeiten</RouterLink> → „Zielländer“ – danach
    erscheinen hier die amtlichen Warnungen der Wetterdienste für eure Orte.
  </div>

  <template v-else-if="trip">
    <section class="card mb-3" data-unwetter-settings>
      <div class="card-body">
        <div class="small fw-semibold mb-2">Warnungen für</div>
        <div class="btn-group flex-wrap mb-2" role="group" aria-label="Warnungen für">
          <button
            v-for="o in ([['orte', 'Unsere Orte'], ['land', 'Ganzes Land'], ['aus', 'Aus']] as const)"
            :key="o[0]"
            type="button"
            class="btn btn-sm"
            :class="settings.scope === o[0] ? 'btn-primary' : 'btn-outline-primary'"
            :aria-pressed="settings.scope === o[0]"
            @click="setScope(o[0])"
          >
            {{ o[1] }}
          </button>
        </div>
        <p class="small text-body-secondary mb-0">
          <template v-if="settings.scope === 'orte'">
            Erkannt an
            {{ watch?.points.length ?? 0 }} Ort{{ watch?.points.length === 1 ? '' : 'en' }} auf der Karte und
            {{ watch?.names.length ?? 0 }} Ortsnamen (Unterkünfte, Unternehmungen, Wetter-Ort, Reiseziel)<template v-if="settings.regions.length">
              und {{ settings.regions.length }} beobachteten Region{{ settings.regions.length === 1 ? '' : 'en' }}</template>.
            <details v-if="watch?.names.length" class="d-inline">
              <summary class="d-inline text-decoration-underline">Welche?</summary>
              <span class="d-block">{{ watch.names.join(' · ') }}</span>
            </details>
          </template>
          <template v-else-if="settings.scope === 'land'">Alle Warnungen in {{ countries.map(countryName).join(', ') }}.</template>
          <template v-else>Für diese Reise werden keine Unwetterwarnungen geholt oder geschickt.</template>
        </p>
        <div v-if="settings.regions.length" class="mt-2 d-flex flex-wrap gap-1 align-items-center" data-watched-regions>
          <span class="small">Beobachtete Regionen:</span>
          <button v-for="r in settings.regions" :key="r" type="button" class="btn btn-sm btn-outline-secondary py-0" :aria-label="`${settings.regionNames?.[r] || r} nicht mehr beobachten`" @click="toggle(r, '')">
            {{ settings.regionNames?.[r] || r }} <i class="bi bi-x" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </section>

    <div v-if="!hasServer" class="alert alert-info">
      {{ NO_SERVER }} <RouterLink to="/abgleich">Zum Geräte-Abgleich</RouterLink>
    </div>

    <template v-else-if="settings.scope !== 'aus'">
      <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
        <button type="button" class="btn btn-outline-primary btn-sm" :disabled="busy || !online" data-unwetter-refresh @click="refresh">
          <span v-if="busy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
          <i v-else class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Jetzt prüfen
        </button>
        <span v-if="cache" class="small text-body-secondary on-bg">Stand {{ when(cache.checkedAt) }}</span>
        <span v-if="!soon" class="small text-body-secondary on-bg">· automatisch ab 3 Tagen vor der Reise</span>
      </div>
      <div v-if="error" class="alert alert-danger py-2 small" role="alert">{{ error }}</div>
      <div v-for="e in cache?.errors ?? []" :key="e.country" class="alert py-2 small" :class="e.unsupported ? 'alert-secondary' : 'alert-warning'">
        {{ flag(e.country) }} {{ countryName(e.country) }}: {{ e.message }}
      </div>

      <div v-if="cache && !relevant.length && cache.countries.length" class="alert alert-success d-flex align-items-center gap-2" data-unwetter-none>
        <i class="bi bi-sun fs-4" aria-hidden="true"></i>
        <div>Keine Warnungen für eure Orte.<span v-if="others.length" class="d-block small">Im Land gibt es {{ others.length }} weitere – siehe unten.</span></div>
      </div>

      <article v-for="w in relevant" :key="w.id" class="card mb-3 warning" :style="{ '--lvl': level(w.level).bg }" data-warning>
        <div class="card-body">
          <div class="d-flex align-items-start gap-3">
            <div class="lvl-icon" :style="{ background: level(w.level).bg, color: level(w.level).fg }" aria-hidden="true">
              <i :class="`bi bi-${icon(w)}`"></i>
            </div>
            <div class="flex-grow-1">
              <h2 class="h5 mb-1">
                {{ w.typeName }}
                <span class="badge ms-1" :style="{ background: level(w.level).bg, color: level(w.level).fg }">{{ level(w.level).label }} · {{ level(w.level).text }}</span>
                <span v-if="isActiveNow(w)" class="badge text-bg-dark ms-1">läuft gerade</span>
              </h2>
              <div class="small"><i class="bi bi-geo-alt me-1" aria-hidden="true"></i>{{ w.match?.area || w.areas.map((a) => a.name).join(', ') }} <span class="text-body-secondary">({{ flag(w.country) }} {{ countryName(w.country) }})</span></div>
              <div class="small"><i class="bi bi-clock me-1" aria-hidden="true"></i>{{ period(w.onset, w.expires) }}</div>
              <div v-if="w.headline" class="small fst-italic mt-1">{{ w.headline }}</div>
            </div>
          </div>
          <details v-if="w.description || w.instruction" class="mt-2 small">
            <summary>Was ist zu erwarten, was tun?</summary>
            <p v-if="w.description" class="mt-2 mb-1 pre">{{ w.description }}</p>
            <p v-if="w.instruction" class="mb-1 pre"><strong>Empfehlung:</strong> {{ w.instruction }}</p>
          </details>
          <div class="small text-body-secondary mt-2">
            {{ w.match ? MATCH_LABELS[w.match.how] : '' }}<template v-if="w.sender"> · {{ w.sender }}</template>
            <template v-if="w.web"> · <a :href="w.web" target="_blank" rel="noopener">Wetterdienst</a></template>
          </div>
        </div>
      </article>

      <details v-if="others.length" class="card mb-3" data-unwetter-others>
        <summary class="card-body py-2">Weitere Warnungen im Land ({{ others.length }})</summary>
        <ul class="list-group list-group-flush">
          <li v-for="w in others" :key="w.id" class="list-group-item small d-flex flex-wrap align-items-center gap-2">
            <span class="badge" :style="{ background: level(w.level).bg, color: level(w.level).fg }">{{ level(w.level).label }}</span>
            <i :class="`bi bi-${icon(w)}`" aria-hidden="true"></i>
            <span class="fw-semibold">{{ w.typeName }}</span>
            <span>{{ w.areas.map((a) => a.name).join(', ') }}</span>
            <span class="text-body-secondary">{{ period(w.onset, w.expires) }}</span>
            <button
              v-for="a in areaCodes(w)"
              :key="a.code"
              type="button"
              class="btn btn-sm py-0 ms-auto"
              :class="watched(a.code) ? 'btn-secondary' : 'btn-outline-secondary'"
              @click="toggle(a.code, a.name)"
            >
              <i class="bi bi-eye me-1" aria-hidden="true"></i>{{ a.name }} {{ watched(a.code) ? 'beobachtet' : 'beobachten' }}
            </button>
          </li>
        </ul>
        <p class="small text-body-secondary px-3 pb-2 mb-0">
          Tipp: Fehlt eine Warnung für euren Ort, die Region hier beobachten – künftige Warnungen dort zählen dann immer.
        </p>
      </details>

      <div class="card mb-3">
        <div class="card-body small d-flex gap-2 align-items-center">
          <i class="bi fs-4" :class="pushState.active ? 'bi-bell-fill text-primary' : 'bi-bell'" aria-hidden="true"></i>
          <div>
            <template v-if="pushState.active">Neue Warnungen kommen auf diesem Gerät als Benachrichtigung – Stufe einstellbar unter <RouterLink to="/benachrichtigungen">Benachrichtigungen</RouterLink>.</template>
            <template v-else>Neue Warnungen auch bei geschlossener App melden: <RouterLink to="/benachrichtigungen">Benachrichtigungen einschalten</RouterLink>.</template>
          </div>
        </div>
      </div>
    </template>

    <p class="small text-body-secondary on-bg">
      Quelle: <a :href="SOURCE_URL" target="_blank" rel="noopener">MeteoAlarm</a> (EUMETNET) – amtliche Warnungen der nationalen Wetterdienste.
      Angaben ohne Gewähr; vor Ort zählen die Hinweise der Behörden.
    </p>
  </template>
</template>

<style scoped>
.warning {
  border-left: 0.4rem solid var(--lvl);
}
.lvl-icon {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  flex: none;
}
.pre {
  white-space: pre-line;
}
summary {
  cursor: pointer;
}
</style>
