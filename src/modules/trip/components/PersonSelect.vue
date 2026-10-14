<script setup lang="ts">
import { computed } from 'vue'
import { useLiveQuery } from '@/core/composables'
import { tripRepository } from '../repository'
import { participantsOf } from '../logic'
import type { Trip } from '../types'
import { isMine, linkedMember, people as accounts } from '@/core/people'

/**
 * Auswahl "Für wen?" – nutzt die Teilnehmer der Reise.
 * Ohne Teilnehmer erscheint ein freies Textfeld (wie bisher).
 * Leerer Wert = für alle / gemeinsam.
 */
const props = defineProps<{ tripId: string; inputId?: string; /** Hinweis, ob der Eintrag privat wird (Personen & Rechte) */ privacy?: boolean }>()
const model = defineModel<string>({ required: true })

const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const people = computed(() => participantsOf(trip.value))
/** Ein früher frei eingetragener Name, der nicht (mehr) in der Teilnehmerliste steht, bleibt wählbar. */
const extra = computed(() => (model.value && !people.value.includes(model.value) ? [model.value] : []))
const owner = computed(() => (props.privacy && accounts.enabled ? linkedMember(accounts, trip.value?.memberLinks, model.value) : null))
const mine = computed(() => isMine(accounts, trip.value?.memberLinks, model.value))
</script>

<template>
  <select v-if="people.length" :id="inputId" v-model="model" class="form-select">
    <option value="">{{ $t('Alle / gemeinsam') }}</option>
    <option v-for="p in [...people, ...extra]" :key="p" :value="p">{{ p }}</option>
  </select>
  <input v-else :id="inputId" v-model="model" class="form-control" :placeholder="$t('leer = für alle')" />
  <div v-if="owner && mine" class="form-text" data-private><i class="bi bi-lock me-1" aria-hidden="true"></i>{{ $t('Privat – gehört zu deinem Konto.') }}</div>
  <div v-else-if="owner && accounts.me" class="form-text text-warning-emphasis" data-private>
    <i class="bi bi-lock me-1" aria-hidden="true"></i>{{ $t('Gehört {0} – nach dem Speichern sieht nur {1} diesen Eintrag.', [owner.name, owner.name]) }}
  </div>
</template>
