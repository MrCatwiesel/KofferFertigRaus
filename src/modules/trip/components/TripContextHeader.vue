<script setup lang="ts">
import { useLiveQuery } from '@/core/composables'
import { formatDate } from '@/core/format'
import { tripRepository } from '../repository'
import type { Trip } from '../types'
import ReadOnlyNote from './ReadOnlyNote.vue'

/** Kopfzeile für Unterseiten einer Reise (Zurück-Link + Reisename). */
const props = defineProps<{ tripId: string; title: string }>()
const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
</script>

<template>
  <div class="mb-3">
    <RouterLink :to="`/trip/${tripId}`" class="small text-decoration-none">
      <i class="bi bi-chevron-left" aria-hidden="true"></i>
      {{ trip?.title ?? t('Zurück zur Reise') }}
    </RouterLink>
    <h1 class="h3 mb-0 mt-1">{{ title }}</h1>
    <p v-if="trip" class="small text-body-secondary mb-0">
      {{ trip.destination }} · {{ formatDate(trip.startDate) }} – {{ formatDate(trip.endDate) }}
    </p>
    <slot />
    <ReadOnlyNote :trip-id="tripId" class="mt-2 mb-0" />
  </div>
</template>
