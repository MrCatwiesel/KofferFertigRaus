<script setup lang="ts">
import { computed } from 'vue'
import { useLiveQuery } from '@/core/composables'
import { formatDayShort, formatMoney, safeUrl } from '@/core/format'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import { travelRepository } from '../repository'
import {
  appleMapsUrl, brokenConnections, durationMinutes, formatDuration, googleMapsUrl, legCost, legsOf,
  recommendedBreaks, reverseLegs, summarize
} from '../logic'
import { DIRECTION, MODE, type TravelDirection, type TravelLeg } from '../types'

const props = defineProps<{ tripId: string }>()

const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const list = useLiveQuery(() => travelRepository.listByTrip(props.tripId), [] as TravelLeg[])

const directions: TravelDirection[] = ['hin', 'rueck']

const groups = computed(() =>
  directions.map((dir) => {
    const legs = legsOf(list.value, dir)
    return {
      dir,
      legs,
      broken: new Set(brokenConnections(legs)),
      summary: summarize(list.value, dir, trip.value?.currency ?? 'EUR')
    }
  })
)

const canReverse = computed(() => groups.value[0].legs.length > 0 && groups.value[1].legs.length === 0)

async function createReturn() {
  if (!trip.value) return
  await travelRepository.createMany(props.tripId, reverseLegs(groups.value[0].legs, trip.value.endDate))
}

function move(dir: TravelDirection, id: string, delta: -1 | 1) {
  travelRepository.move(props.tripId, dir, id, delta)
}

function duration(l: TravelLeg) {
  return durationMinutes(l.departTime, l.arriveTime)
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" title="An- und Rückreise" />
  <RouterLink :to="`/trip/${tripId}/buchung`" class="btn btn-outline-primary btn-sm mb-3">
    <i class="bi bi-file-earmark-arrow-down me-1" aria-hidden="true"></i>Buchung einlesen (Flug, Bahn, Bus)
  </RouterLink>

  <section v-for="g in groups" :key="g.dir" class="mb-4">
    <div class="d-flex align-items-baseline justify-content-between mb-2">
      <h2 class="h5 mb-0">{{ DIRECTION[g.dir] }}</h2>
      <RouterLink :to="{ path: `/trip/${tripId}/anreise/neu`, query: { richtung: g.dir } }" class="btn btn-sm btn-outline-primary">
        <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Etappe
      </RouterLink>
    </div>

    <!-- Kennzahlen -->
    <div v-if="g.summary.legs" class="d-flex flex-wrap gap-2 small mb-2">
      <span v-if="g.summary.distanceKm" class="badge text-bg-light border">
        <i class="bi bi-rulers me-1" aria-hidden="true"></i>{{ Math.round(g.summary.distanceKm) }} km
      </span>
      <span v-if="g.summary.travelMinutes" class="badge text-bg-light border">
        <i class="bi bi-clock me-1" aria-hidden="true"></i>{{ formatDuration(g.summary.travelMinutes) }} unterwegs
      </span>
      <span v-if="g.summary.cost && trip" class="badge text-bg-light border">
        <i class="bi bi-wallet2 me-1" aria-hidden="true"></i>{{ formatMoney(g.summary.cost, trip.currency) }}
      </span>
    </div>

    <p v-if="g.legs.length === 0" class="text-body-secondary small mb-0">
      Noch keine Etappe.
      <template v-if="g.dir === 'rueck' && canReverse">
        <button type="button" class="btn btn-link btn-sm p-0 align-baseline" @click="createReturn">
          Rückreise aus der Hinreise übernehmen
        </button>
      </template>
    </p>

    <!-- Etappen als Zeitleiste -->
    <ol class="list-unstyled mb-0 leg-list">
      <li v-for="(l, i) in g.legs" :key="l.id" class="leg">
        <div v-if="g.broken.has(l.id)" class="small text-warning-emphasis mb-1">
          <i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>
          Lücke: vorher endet in „{{ g.legs[i - 1].to }}“
        </div>
        <div class="card position-relative">
          <div class="card-body py-2 d-flex gap-3">
            <div class="leg-icon"><i :class="`bi bi-${MODE[l.mode].icon}`" aria-hidden="true"></i></div>
            <div class="flex-grow-1 min-w-0">
              <RouterLink :to="`/trip/${tripId}/anreise/${l.id}`" class="fw-semibold text-body text-decoration-none stretched-link">
                {{ l.from }} <i class="bi bi-arrow-right small" aria-hidden="true"></i> {{ l.to }}
              </RouterLink>
              <div class="small text-body-secondary">
                {{ MODE[l.mode].label }}
                <template v-if="l.date"> · {{ formatDayShort(l.date) }}</template>
                <template v-if="l.departTime"> · {{ l.departTime }}</template>
                <template v-if="l.arriveTime"> – {{ l.arriveTime }}</template>
                <template v-if="duration(l) !== null"> ({{ formatDuration(duration(l)!) }})</template>
                <template v-if="l.distanceKm"> · {{ l.distanceKm }} km</template>
                <template v-if="legCost(l) !== null"> · {{ formatMoney(legCost(l)!, l.currency) }}</template>
              </div>
              <div v-if="recommendedBreaks(l.mode, duration(l)) > 0" class="small text-body-secondary">
                <i class="bi bi-cup-hot me-1" aria-hidden="true"></i>
                {{ recommendedBreaks(l.mode, duration(l)) }} {{ recommendedBreaks(l.mode, duration(l)) === 1 ? 'Pause' : 'Pausen' }}
                einplanen (alle 2 Std. ca. 15–20 Min.)
              </div>
              <div class="d-flex flex-wrap gap-3 small mt-1 position-relative z-2">
                <a :href="appleMapsUrl(l.from, l.to, l.mode)" target="_blank" rel="noopener noreferrer">
                  <i class="bi bi-map me-1" aria-hidden="true"></i>Apple Karten
                </a>
                <a :href="googleMapsUrl(l.from, l.to, l.mode)" target="_blank" rel="noopener noreferrer">
                  <i class="bi bi-google me-1" aria-hidden="true"></i>Google Maps
                </a>
                <a v-if="safeUrl(l.url)" :href="safeUrl(l.url)!" target="_blank" rel="noopener noreferrer">
                  <i class="bi bi-ticket-perforated me-1" aria-hidden="true"></i>Buchung
                </a>
              </div>
            </div>
            <div class="d-flex flex-column gap-1 position-relative z-2">
              <button type="button" class="btn btn-sm btn-outline-secondary py-0" :disabled="i === 0"
                      aria-label="Nach oben" @click="move(g.dir, l.id, -1)">
                <i class="bi bi-chevron-up" aria-hidden="true"></i>
              </button>
              <button type="button" class="btn btn-sm btn-outline-secondary py-0" :disabled="i === g.legs.length - 1"
                      aria-label="Nach unten" @click="move(g.dir, l.id, 1)">
                <i class="bi bi-chevron-down" aria-hidden="true"></i>
              </button>
            </div>
          </div>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.leg-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.leg-icon {
  width: 2.25rem;
  height: 2.25rem;
  flex: none;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--bs-primary-bg-subtle);
  color: var(--bs-primary);
  font-size: 1.1rem;
}
.min-w-0 {
  min-width: 0;
}
</style>
