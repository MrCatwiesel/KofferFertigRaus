<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLiveQuery } from '@/core/composables'
import { flag } from '@/core/countries'
import { tripRepository } from '../repository'
import { formatDate, tripPhase, tripStatusText } from '../logic'
import type { Trip } from '../types'
import TripCover from '../components/TripCover.vue'

const trips = useLiveQuery(() => tripRepository.listAll(), [] as Trip[])
const showArchive = ref(false)

/** Gruppen: unterwegs, geplant (bald zuerst), Erinnerungen (neueste zuerst), Archiv */
const groups = computed(() => {
  const active = trips.value.filter((t) => !t.archived)
  const by = (p: string) => active.filter((t) => tripPhase(t.startDate, t.endDate) === p)
  return [
    { id: 'unterwegs', title: 'Gerade unterwegs', trips: by('unterwegs') },
    { id: 'planung', title: 'Geplant', trips: by('planung').sort((a, b) => a.startDate.localeCompare(b.startDate)) },
    { id: 'vorbei', title: 'Erinnerungen', trips: by('vorbei') }
  ].filter((g) => g.trips.length)
})
const archived = computed(() => trips.value.filter((t) => t.archived))
</script>

<template>
  <div class="d-flex align-items-center justify-content-between mb-3">
    <h1 class="h3 mb-0">Meine Reisen</h1>
    <div class="d-flex gap-2">
      <RouterLink v-if="trips.length" to="/statistik" class="btn btn-outline-primary" aria-label="Statistik">
        <i class="bi bi-bar-chart" aria-hidden="true"></i><span class="d-none d-sm-inline ms-1">Statistik</span>
      </RouterLink>
      <RouterLink to="/trip/neu" class="btn btn-primary">
        <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>Neue Reise
      </RouterLink>
    </div>
  </div>

  <div v-if="trips.length === 0" class="card text-center py-5 px-3">
    <i class="bi bi-globe-europe-africa display-4 d-block mb-3 text-primary" aria-hidden="true"></i>
    <p class="mb-3">Noch keine Reise angelegt.</p>
    <div><RouterLink to="/trip/neu" class="btn btn-outline-primary">Erste Reise planen</RouterLink></div>
  </div>

  <section v-for="g in groups" :key="g.id" class="mb-4">
    <h2 class="h6 text-body-secondary text-uppercase small mb-2 on-bg">{{ g.title }}</h2>
    <div class="row g-3">
      <div v-for="t in g.trips" :key="t.id" class="col-12 col-md-6 col-lg-4">
        <RouterLink :to="`/trip/${t.id}`" class="trip-card d-block text-decoration-none">
          <TripCover :trip="t" class="trip-card-cover">
            <div class="h-100 d-flex flex-column justify-content-end p-3 text-white trip-card-text">
              <div class="small"><span v-for="c in t.countries ?? []" :key="c" class="me-1">{{ flag(c) }}</span>{{ tripStatusText(t.startDate, t.endDate) }}</div>
              <div class="h4 mb-0 trip-card-title">{{ t.title }}</div>
            </div>
          </TripCover>
          <div class="trip-card-body small">
            <span class="text-truncate"><i class="bi bi-geo-alt me-1" aria-hidden="true"></i>{{ t.destination }}</span>
            <span class="text-body-secondary flex-none">{{ formatDate(t.startDate) }}</span>
          </div>
        </RouterLink>
      </div>
    </div>
  </section>

  <section v-if="archived.length" class="mb-4">
    <button type="button" class="btn btn-link px-0 text-decoration-none" :aria-expanded="showArchive" @click="showArchive = !showArchive">
      <i class="bi me-1" :class="showArchive ? 'bi-chevron-down' : 'bi-chevron-right'" aria-hidden="true"></i>
      <i class="bi bi-archive me-1" aria-hidden="true"></i>Archiv ({{ archived.length }})
    </button>
    <div v-if="showArchive" class="list-group mt-2">
      <RouterLink v-for="t in archived" :key="t.id" :to="`/trip/${t.id}`" class="list-group-item list-group-item-action d-flex align-items-center gap-3">
        <TripCover :trip="t" class="archive-thumb" />
        <span class="flex-grow-1 min-w-0">
          <span class="d-block fw-semibold text-truncate">{{ t.title }}</span>
          <span class="d-block small text-body-secondary text-truncate">{{ t.destination }} · {{ formatDate(t.startDate) }}</span>
        </span>
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.trip-card {
  overflow: hidden;
  color: var(--nww-text);
  background: var(--nww-card-bg);
  border: var(--nww-border-width) solid var(--nww-border);
  border-radius: var(--bs-border-radius-lg);
  box-shadow: var(--nww-shadow);
  transition: transform 0.15s ease;
}
.trip-card:hover {
  transform: translateY(-2px);
}

.trip-card-cover {
  height: 150px;
}
.trip-card-text {
  text-shadow: 0 1px 10px rgba(0, 0, 0, 0.5);
}
.trip-card-title {
  font-family: var(--nww-heading-font);
}
.trip-card-body {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
}
.archive-thumb {
  flex: none;
  width: 64px;
  height: 44px;
  border-radius: calc(var(--nww-radius) * 0.6);
}
.min-w-0 {
  min-width: 0;
}
.flex-none {
  flex: none;
}
</style>
