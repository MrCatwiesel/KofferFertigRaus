<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLiveQuery } from '@/core/composables'
import { flag } from '@/core/countries'
import { tripRepository } from '../repository'
import { formatDate, tripPhase, tripStatusText } from '../logic'
import type { Trip } from '../types'
import TripCover from '../components/TripCover.vue'
import { canCreateTrips } from '@/core/people'
import WelcomeCard from '@/help/WelcomeCard.vue'
import WhatsNewHint from '@/help/WhatsNewHint.vue'

// null = noch nicht geladen (sonst blitzt beim Start kurz die Willkommen-Ansicht auf)
const loaded = useLiveQuery(() => tripRepository.listAll(), null as Trip[] | null)
const trips = computed(() => loaded.value ?? [])
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
    <h1 class="h3 mb-0">{{ t('Meine Reisen') }}</h1>
    <div class="d-flex gap-2">
      <RouterLink v-if="trips.length" to="/statistik" class="btn btn-outline-primary" :aria-label="t('Statistik')">
        <i class="bi bi-bar-chart" aria-hidden="true"></i><span class="d-none d-sm-inline ms-1">{{ t('Statistik') }}</span>
      </RouterLink>
      <RouterLink v-if="canCreateTrips()" to="/trip/neu" class="btn btn-primary">
        <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>{{ t('Neue Reise') }}
      </RouterLink>
    </div>
  </div>

  <WhatsNewHint />

  <WelcomeCard v-if="loaded && loaded.length === 0" />

  <section v-for="g in groups" :key="g.id" class="mb-4">
    <h2 class="h6 text-body-secondary text-uppercase small mb-2 on-bg">{{ g.title }}</h2>
    <div class="row g-3">
      <div v-for="trip in g.trips" :key="trip.id" class="col-12 col-md-6 col-lg-4">
        <RouterLink :to="`/trip/${trip.id}`" class="trip-card d-block text-decoration-none">
          <TripCover :trip="trip" class="trip-card-cover">
            <div class="h-100 d-flex flex-column justify-content-end p-3 text-white trip-card-text">
              <div class="small"><span v-for="c in trip.countries ?? []" :key="c" class="me-1">{{ flag(c) }}</span>{{ tripStatusText(trip.startDate, trip.endDate) }}</div>
              <div class="h4 mb-0 trip-card-title">{{ trip.title }}</div>
            </div>
          </TripCover>
          <div class="trip-card-body small">
            <span class="text-truncate"><i class="bi bi-geo-alt me-1" aria-hidden="true"></i>{{ trip.destination }}</span>
            <span class="text-body-secondary flex-none">{{ formatDate(trip.startDate) }}</span>
          </div>
        </RouterLink>
      </div>
    </div>
  </section>

  <section v-if="archived.length" class="mb-4">
    <button type="button" class="btn btn-link px-0 text-decoration-none" :aria-expanded="showArchive" @click="showArchive = !showArchive">
      <i class="bi me-1" :class="showArchive ? 'bi-chevron-down' : 'bi-chevron-right'" aria-hidden="true"></i>
      <i class="bi bi-archive me-1" aria-hidden="true"></i>{{ t('Archiv ({n})', { n: archived.length }) }}
    </button>
    <div v-if="showArchive" class="list-group mt-2">
      <RouterLink v-for="trip in archived" :key="trip.id" :to="`/trip/${trip.id}`" class="list-group-item list-group-item-action d-flex align-items-center gap-3">
        <TripCover :trip="trip" class="archive-thumb" />
        <span class="flex-grow-1 min-w-0">
          <span class="d-block fw-semibold text-truncate">{{ trip.title }}</span>
          <span class="d-block small text-body-secondary text-truncate">{{ trip.destination }} · {{ formatDate(trip.startDate) }}</span>
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
