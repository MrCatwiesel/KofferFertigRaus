<script setup lang="ts">
import { computed } from 'vue'
import { useLiveQuery } from '@/core/composables'
import { isMine, people, sharedLabel } from '@/core/people'
import { tripRepository } from '../repository'
import type { Trip } from '../types'

/**
 * Freigabe eines privaten Eintrags (Dokument, Medikament): nur ich / alle / ausgewählte Personen.
 * Erscheint nur, wenn der gewählte Teilnehmer mit meinem Konto verknüpft ist.
 */
const props = defineProps<{ tripId: string; person: string }>()
const model = defineModel<string[] | undefined>()

const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const visible = computed(() => isMine(people, trip.value?.memberLinks, props.person))
const others = computed(() => people.members.filter((m) => m.id !== people.me?.id))
const list = computed(() => model.value ?? [])
const mode = computed(() => (list.value.includes('*') ? 'alle' : list.value.length ? 'auswahl' : 'ich'))

function setMode(m: string) {
  if (m === 'alle') model.value = ['*']
  else if (m === 'ich') model.value = []
  else model.value = list.value.filter((x) => x !== '*').length ? list.value.filter((x) => x !== '*') : others.value.slice(0, 1).map((o) => o.id)
}
function toggle(id: string, on: boolean) {
  const cur = list.value.filter((x) => x !== '*' && x !== id)
  model.value = on ? [...cur, id] : cur
}
</script>

<template>
  <div v-if="visible" class="border rounded p-2" data-visibility>
    <label for="visibility" class="form-label small fw-semibold mb-1"><i class="bi bi-person-lock me-1" aria-hidden="true"></i>Wer darf das sehen?</label>
    <select id="visibility" class="form-select form-select-sm" :value="mode" @change="setMode(($event.target as HTMLSelectElement).value)">
      <option value="ich">Nur ich</option>
      <option value="alle">Alle in der Reisegruppe</option>
      <option v-if="others.length" value="auswahl">Ausgewählte Personen …</option>
    </select>
    <div v-if="mode === 'auswahl'" class="d-flex flex-wrap gap-3 mt-2">
      <div v-for="o in others" :key="o.id" class="form-check">
        <input :id="`vis-${o.id}`" class="form-check-input" type="checkbox" :checked="list.includes(o.id)" @change="toggle(o.id, ($event.target as HTMLInputElement).checked)" />
        <label class="form-check-label small" :for="`vis-${o.id}`">{{ o.name }}</label>
      </div>
    </div>
    <div class="form-text mt-1">{{ sharedLabel(people, model) }}. Z. B. Allergiepass oder INR-Ausweis für die Mitreisenden freigeben – für den Notfall.</div>
  </div>
</template>
