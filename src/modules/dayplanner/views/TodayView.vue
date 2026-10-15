<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useLiveQuery } from '@/core/composables'
import { diffDays, todayIso } from '@/core/dates'
import { formatDate } from '@/core/format'
import { tripRepository, type Trip } from '@/modules/trip/public'
import { DueReminders } from '@/modules/termine/public'

/**
 * "Heute": springt direkt in den Tagesplan der laufenden Reise.
 * Läuft keine Reise, zeigt sie die nächste an.
 */
const router = useRouter()
const trips = useLiveQuery(() => tripRepository.listAll(), null as Trip[] | null)
const today = todayIso()

// Eine echte Reise geht der Beispielreise vor
const running = computed(() => {
  const now = (trips.value ?? []).filter((t) => t.startDate <= today && today <= t.endDate)
  return now.find((t) => !t.sample) ?? now[0]
})
const next = computed(() =>
  (trips.value ?? []).filter((t) => t.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
)

watch(running, (t) => {
  if (t) router.replace({ path: `/trip/${t.id}/tagesplan`, query: { tag: today } })
}, { immediate: true })
</script>

<template>
  <div class="text-center py-5">
    <template v-if="trips === null || running">
      <span class="spinner-border text-primary" aria-hidden="true"></span>
    </template>
    <template v-else-if="next">
      <div class="mx-auto mb-4" style="max-width: 36rem"><DueReminders :trip-id="next.id" /></div>
      <i class="bi bi-hourglass-split display-4 text-primary d-block mb-3" aria-hidden="true"></i>
      <p class="mb-1">{{ t('Gerade läuft keine Reise.') }}</p>
      <p class="text-body-secondary">
        {{ t('Nächste Reise:') }} <strong>{{ next.title }}</strong> {{ t('in {diffDays} Tagen ({startDate}).', { diffDays: diffDays(today, next.startDate), startDate: formatDate(next.startDate) }) }}
      </p>
      <div class="d-flex gap-2 justify-content-center flex-wrap">
        <RouterLink :to="`/trip/${next.id}/tagesplan`" class="btn btn-primary">{{ t('Tage schon planen') }}</RouterLink>
        <RouterLink :to="`/trip/${next.id}`" class="btn btn-outline-secondary">{{ t('Zur Reise') }}</RouterLink>
      </div>
    </template>
    <template v-else>
      <i class="bi bi-sun display-4 text-primary d-block mb-3" aria-hidden="true"></i>
      <p class="text-body-secondary">{{ t('Keine laufende oder geplante Reise.') }}</p>
      <RouterLink to="/trip/neu" class="btn btn-primary">{{ t('Reise planen') }}</RouterLink>
    </template>
  </div>
</template>
