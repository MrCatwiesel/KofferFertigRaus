<script setup lang="ts">
/** Bereiche einer Reise als Kacheln, Liste oder große Kacheln (Einstellung „Reiseseite“). */
import type { TripSection } from '@/core/registry'
import type { TripLayout } from '@/core/trip-layout'
import { formatMoney } from '../logic'

defineProps<{
  items: { s: TripSection & { moduleId: string }; i: number }[]
  data: { summary: string; cost: number }[]
  tripId: string
  currency: string
  view: TripLayout['view']
  summaries: boolean
  showCost: boolean
}>()
</script>

<template>
  <div v-if="view === 'liste'" class="list-group mb-3">
    <RouterLink v-for="{ s, i } in items" :key="s.moduleId" :to="s.to(tripId)" class="list-group-item list-group-item-action d-flex align-items-center gap-3 py-2"
                :data-section="s.moduleId">
      <i :class="`bi bi-${s.icon} text-primary fs-5`" aria-hidden="true"></i>
      <span class="flex-grow-1 min-w-0">
        <span class="d-block fw-semibold">{{ s.title }}</span>
        <span v-if="summaries" class="d-block small text-body-secondary text-truncate">{{ data[i]?.summary ?? '…' }}</span>
      </span>
      <span v-if="showCost && data[i]?.cost" class="small text-body-secondary">{{ formatMoney(data[i].cost, currency) }}</span>
      <i class="bi bi-chevron-right text-body-secondary" aria-hidden="true"></i>
    </RouterLink>
  </div>

  <div v-else class="row g-3 mb-3">
    <div v-for="{ s, i } in items" :key="s.moduleId" :class="view === 'gross' ? 'col-12 col-md-6' : 'col-12 col-sm-6 col-lg-4'">
      <RouterLink :to="s.to(tripId)" class="nww-tile" :class="{ 'nww-tile-big': view === 'gross' }" :data-section="s.moduleId">
        <span class="nww-tile-icon"><i :class="`bi bi-${s.icon}`" aria-hidden="true"></i></span>
        <span class="flex-grow-1 min-w-0">
          <span class="d-block fw-semibold">{{ s.title }}</span>
          <span v-if="summaries" class="d-block small text-body-secondary">{{ data[i]?.summary ?? '…' }}</span>
          <span v-if="showCost && data[i]?.cost" class="d-block small text-body-secondary mt-1">
            <i class="bi bi-cash-coin me-1" aria-hidden="true"></i>{{ formatMoney(data[i].cost, currency) }}
          </span>
        </span>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.nww-tile-big {
  padding: 1.25rem;
  font-size: 1.1rem;
}
.nww-tile-big .nww-tile-icon {
  width: 3.4rem;
  height: 3.4rem;
  font-size: 1.6rem;
}
.min-w-0 {
  min-width: 0;
}
</style>
