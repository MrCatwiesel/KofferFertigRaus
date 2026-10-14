<script setup lang="ts">
/** Kompakte Liste: was heute fällig oder überfällig ist (für „Heute“ und den Tagesplan). */
import { computed } from 'vue'
import { useLiveQuery } from '@/core/composables'
import { todayIso } from '@/core/dates'
import { KIND_LABEL, groupOf, type Reminder } from '@/core/reminders'
import { tripRepository } from '@/modules/trip/public'
import { remindersOfTrip } from '../calendar'

const props = defineProps<{ tripId: string }>()
const today = todayIso()
const list = useLiveQuery(async () => {
  const t = await tripRepository.get(props.tripId)
  return t ? remindersOfTrip(t, today) : []
}, [] as Reminder[])
const due = computed(() => list.value.filter((r) => r.id !== `trip:${props.tripId}` && ['ueberfaellig', 'heute'].includes(groupOf(r, today))))
</script>

<template>
  <div v-if="due.length" class="card mb-3 text-start" data-due-reminders>
    <div class="card-body py-2">
      <div class="d-flex align-items-center gap-2 mb-1">
        <i class="bi bi-bell text-primary" aria-hidden="true"></i>
        <span class="fw-semibold flex-grow-1">{{ $t('Heute dran') }}</span>
        <RouterLink :to="`/trip/${tripId}/termine`" class="small">{{ $t('Alle Termine') }}</RouterLink>
      </div>
      <RouterLink v-for="r in due" :key="r.id" :to="r.to ?? `/trip/${tripId}/termine`" class="d-flex gap-2 py-1 text-decoration-none text-body border-top">
        <i :class="`bi bi-${KIND_LABEL[r.kind].icon}`" aria-hidden="true"></i>
        <span class="flex-grow-1">{{ r.title }}<span v-if="r.time" class="text-body-secondary"> {{ $t('· {0} Uhr', [r.time]) }}</span></span>
        <span v-if="groupOf(r, today) === 'ueberfaellig'" class="badge text-bg-danger align-self-center">{{ $t('überfällig') }}</span>
      </RouterLink>
    </div>
  </div>
</template>
