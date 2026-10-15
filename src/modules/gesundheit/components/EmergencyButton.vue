<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useLiveQuery } from '@/core/composables'
import { todayIso } from '@/core/dates'
import { tripRepository, type Trip } from '@/modules/trip/public'

/**
 * Notfall-Knopf in der Kopfzeile – nur während einer Reise. Auf den Seiten einer laufenden Reise gilt diese,
 * sonst die laufende Reise (eine echte geht der Beispielreise vor).
 */
const route = useRoute()
const trips = useLiveQuery(() => tripRepository.listAll(), [] as Trip[])
const running = computed(() => {
  const today = todayIso()
  const now = trips.value.filter((t) => t.startDate <= today && today <= t.endDate)
  const here = typeof route.params.tripId === 'string' ? now.find((t) => t.id === route.params.tripId) : undefined
  return here ?? now.find((t) => !t.sample) ?? now[0]
})
</script>

<template>
  <RouterLink
    v-if="running && route.name !== 'emergency'" :to="`/trip/${running.id}/sos`" class="sos-badge text-decoration-none"
    :title="t('Notfall: Notruf, Allergien, Medikamente')" :aria-label="t('Notfall')" data-emergency-button
  >
    <i class="bi bi-heart-pulse-fill" aria-hidden="true"></i>
  </RouterLink>
</template>

<style scoped>
.sos-badge {
  font-size: 1.35rem;
  line-height: 1;
  color: var(--bs-danger);
}
</style>
