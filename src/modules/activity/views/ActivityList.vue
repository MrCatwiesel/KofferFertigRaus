<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLiveQuery } from '@/core/composables'
import { formatDayShort, formatMoney } from '@/core/format'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import { activityRepository } from '../repository'
import { countByStatus, estimatedCost, filterAndSort, plannedHoursByDay, totalEstimatedCost } from '../logic'
import { ACTIVITY_STATUS, CATEGORY, PRIORITY, SETTING, type Activity, type ActivityCategory, type ActivitySetting } from '../types'

const props = defineProps<{ tripId: string }>()

const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const list = useLiveQuery(() => activityRepository.listByTrip(props.tripId), [] as Activity[])

const category = ref<ActivityCategory | ''>('')
const setting = ref<ActivitySetting | ''>('')
const openOnly = ref(false)

const shown = computed(() => filterAndSort(list.value, { category: category.value, setting: setting.value, openOnly: openOnly.value }))
const counts = computed(() => countByStatus(list.value))
const cost = computed(() => (trip.value ? totalEstimatedCost(list.value, trip.value.travelers, trip.value.currency) : 0))
const hoursByDay = computed(() => plannedHoursByDay(list.value))
/** Tage mit mehr als 8 Stunden Programm */
const busyDays = computed(() => Object.entries(hoursByDay.value).filter(([, h]) => h > 8).map(([d]) => d).sort())

function toggleDone(a: Activity) {
  activityRepository.setStatus(a.id, a.status === 'erledigt' ? 'geplant' : 'erledigt')
}

const priorityStars = (p: number) => 4 - p
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="t('Unternehmungen')" />

  <div v-if="list.length" class="d-flex flex-wrap gap-2 small mb-3">
    <span class="badge text-bg-light border">{{ t('{idee} Ideen', { idee: counts.idee }) }}</span>
    <span class="badge text-bg-primary">{{ t('{n} geplant', { n: counts.geplant }) }}</span>
    <span class="badge text-bg-success">{{ t('{n} erledigt', { n: counts.erledigt }) }}</span>
    <span v-if="cost > 0 && trip" class="badge text-bg-light border">
      {{ tn(trip.travelers, 'ca. {cost} für 1 Person', 'ca. {cost} für {n} Personen', { cost: formatMoney(cost, trip.currency) }) }}
    </span>
  </div>

  <div v-if="busyDays.length" class="alert alert-warning py-2 small">
    <i class="bi bi-hourglass-split me-1" aria-hidden="true"></i>
    {{ t('Viel Programm (über 8 Std.): {map}', { map: busyDays.map(formatDayShort).join(', ') }) }}
  </div>

  <RouterLink :to="`/trip/${tripId}/unternehmungen/neu`" class="btn btn-primary mb-3">
    <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>{{ t('Unternehmung hinzufügen') }}
  </RouterLink>

  <!-- Filter -->
  <div v-if="list.length" class="row g-2 mb-3">
    <div class="col-6 col-md-4">
      <select v-model="category" class="form-select form-select-sm" :aria-label="t('Kategorie')">
        <option value="">{{ t('Alle Kategorien') }}</option>
        <option v-for="(c, key) in CATEGORY" :key="key" :value="key">{{ c.label }}</option>
      </select>
    </div>
    <div class="col-6 col-md-4">
      <select v-model="setting" class="form-select form-select-sm" :aria-label="t('Drinnen oder draußen')">
        <option value="">{{ t('Drinnen & draußen') }}</option>
        <option v-for="(s, key) in SETTING" :key="key" :value="key">{{ s.label }}</option>
      </select>
    </div>
    <div class="col-12 col-md-4 d-flex align-items-center">
      <div class="form-check form-switch mb-0">
        <input id="open-only" v-model="openOnly" class="form-check-input" type="checkbox" role="switch" />
        <label class="form-check-label small" for="open-only">{{ t('Nur offene') }}</label>
      </div>
    </div>
  </div>

  <p v-if="list.length === 0" class="text-body-secondary">
    {{ t('Sammle hier alles, was ihr erleben wollt – Sehenswürdigkeiten, Ausflüge, Restaurants. Mit „Drinnen/Draußen“ kann der Tagesplaner später auf das Wetter reagieren.') }}
  </p>
  <p v-else-if="shown.length === 0" class="text-body-secondary">{{ t('Keine Unternehmung passt zum Filter.') }}</p>

  <div class="vstack gap-2">
    <div v-for="a in shown" :key="a.id" class="card position-relative"
         :class="{ 'opacity-50': a.status === 'verworfen' }">
      <div class="card-body py-2 d-flex gap-3 align-items-start">
        <i :class="`bi bi-${CATEGORY[a.category].icon} fs-4 text-primary`" aria-hidden="true"></i>
        <div class="flex-grow-1 min-w-0">
          <RouterLink :to="`/trip/${tripId}/unternehmungen/${a.id}`"
                      class="fw-semibold text-body text-decoration-none stretched-link"
                      :class="{ 'text-decoration-line-through': a.status === 'erledigt' }">{{ a.title }}</RouterLink>
          <div class="small text-body-secondary">
            <span :title="PRIORITY[a.priority]" class="text-warning">
              <i v-for="n in priorityStars(a.priority)" :key="n" class="bi bi-star-fill" aria-hidden="true"></i>
            </span>
            <span class="visually-hidden">{{ t('Priorität: {x}', { x: PRIORITY[a.priority] }) }}</span>
            · <i :class="`bi bi-${SETTING[a.setting].icon}`" aria-hidden="true"></i> {{ SETTING[a.setting].label }}
            <template v-if="a.durationHours"> {{ t('· {durationHours} Std.', { durationHours: a.durationHours }) }}</template>
            <template v-if="a.pricePerPerson && trip"> · {{ formatMoney(estimatedCost(a, trip.travelers), a.currency) }}</template>
          </div>
          <div v-if="a.place || a.openingHours" class="small text-body-secondary text-truncate">
            <template v-if="a.place"><i class="bi bi-geo-alt" aria-hidden="true"></i> {{ a.place }}</template>
            <template v-if="a.openingHours"> · <i class="bi bi-clock" aria-hidden="true"></i> {{ a.openingHours }}</template>
          </div>
          <div class="mt-1">
            <span class="badge" :class="ACTIVITY_STATUS[a.status].badge">{{ ACTIVITY_STATUS[a.status].label }}</span>
            <span v-if="a.plannedDate" class="badge text-bg-light border ms-1">{{ formatDayShort(a.plannedDate) }}</span>
            <span v-if="a.bookingRequired" class="badge text-bg-warning ms-1">{{ t('Reservierung nötig') }}</span>
          </div>
        </div>
        <button v-if="a.status === 'geplant' || a.status === 'erledigt'" type="button"
                class="btn btn-sm position-relative z-2"
                :class="a.status === 'erledigt' ? 'btn-success' : 'btn-outline-success'"
                :aria-label="a.status === 'erledigt' ? t('Als nicht erledigt markieren') : t('Als erledigt markieren')"
                @click="toggleDone(a)">
          <i class="bi bi-check-lg" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.min-w-0 {
  min-width: 0;
}
</style>
