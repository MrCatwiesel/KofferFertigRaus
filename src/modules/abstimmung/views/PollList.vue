<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useLiveQuery } from '@/core/composables'
import { todayIso } from '@/core/dates'
import { getMeta, setMeta } from '@/core/meta'
import { canEdit, linkedMember, myParticipant, people } from '@/core/people'
import { activityRepository, type Activity } from '@/modules/activity/public'
import { TripContextHeader, participantsOf, tripRepository, type Trip } from '@/modules/trip/public'
import PollCard from '../components/PollCard.vue'
import { isOpen, winners } from '../logic'
import { pollRepository } from '../repository'
import type { Poll, PollVote } from '../types'
import { t } from '@/i18n'

const props = defineProps<{ tripId: string }>()
const today = todayIso()
const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const polls = useLiveQuery(() => pollRepository.listByTrip(props.tripId), [] as Poll[])
const votes = useLiveQuery(() => pollRepository.votesByTrip(props.tripId), [] as PollVote[])
const activities = useLiveQuery(() => activityRepository.listByTrip(props.tripId), [] as Activity[])

const participants = computed(() => participantsOf(trip.value))
const editable = computed(() => !people.enabled || canEdit(props.tripId))
/** Mein Name in dieser Reise (Konto verknüpft) – dann ist die Auswahl fest */
const linkedMe = computed(() => myParticipant(people, trip.value?.memberLinks))
/** Namen, die zu anderen Personen gehören – für die stimmen nur sie selbst ab */
const foreign = (name: string) => !!people.me && !!linkedMember(people, trip.value?.memberLinks, name) && name !== linkedMe.value

const META = `abstimmung.ich.${props.tripId}`
const voter = ref('')
onMounted(async () => {
  voter.value = linkedMe.value || (await getMeta(META, ''))
})
watch(linkedMe, (n) => n && (voter.value = n))
watch(voter, (v) => void setMeta(META, v))

const sorted = computed(() =>
  [...polls.value].sort((a, b) => Number(isOpen(b, today)) - Number(isOpen(a, today)) || b.createdAt.localeCompare(a.createdAt))
)
const votesOf = (id: string) => votes.value.filter((v) => v.pollId === id)
const activityTitle = (id: string) => activities.value.find((a) => a.id === id)?.title ?? ''

function adopted(p: Poll): boolean {
  const w = winners(p, votesOf(p.id))
  if (w.length !== 1) return false
  if (p.kind === 'termin' && p.activityId) return activities.value.find((a) => a.id === p.activityId)?.plannedDate === w[0].date
  if (p.kind === 'unternehmung' && w[0].activityId) return ['geplant', 'erledigt'].includes(activities.value.find((a) => a.id === w[0].activityId)?.status ?? '')
  return false
}

async function adopt(p: Poll) {
  const [w] = winners(p, votesOf(p.id))
  if (!w) return
  if (p.kind === 'termin' && p.activityId && w.date) await activityRepository.setPlannedDate(p.activityId, w.date)
  else if (p.kind === 'unternehmung' && w.activityId) await activityRepository.setStatus(w.activityId, 'geplant')
}

async function remove(p: Poll) {
  if (confirm(t('Abstimmung „{question}“ mit allen Stimmen löschen?', { question: p.question }))) await pollRepository.remove(p.id)
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="t('Abstimmungen')" />

  <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
    <RouterLink v-if="editable" :to="`/trip/${tripId}/abstimmungen/neu`" class="btn btn-primary" data-new-poll>
      <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>{{ t('Neue Abstimmung') }}
    </RouterLink>
    <div class="d-flex align-items-center gap-2 ms-auto" data-voter>
      <label for="voter" class="small text-nowrap on-bg">{{ t('Ich stimme ab als') }}</label>
      <select v-if="participants.length" id="voter" v-model="voter" class="form-select form-select-sm w-auto" :disabled="!!linkedMe">
        <option value="" disabled>{{ t('– bitte wählen –') }}</option>
        <option v-for="p in participants" :key="p" :value="p" :disabled="foreign(p)">{{ p }}{{ foreign(p) ? ' ' + t('(eigenes Konto)') : '' }}</option>
      </select>
      <input v-else id="voter" v-model.trim="voter" class="form-control form-control-sm w-auto" :placeholder="t('Name')" />
    </div>
  </div>
  <div v-if="!voter && polls.length" class="alert alert-info small py-2">{{ t('Zum Abstimmen oben deinen Namen wählen.') }}</div>

  <div v-if="!polls.length" class="text-center py-5 on-bg" data-polls-empty>
    <i class="bi bi-hand-thumbs-up display-4 text-primary d-block mb-3" aria-hidden="true"></i>
    <p class="mb-1">{{ t('Noch keine Abstimmung.') }}</p>
    <p class="text-body-secondary small">
      {{ t('Wohin am Sonntag? Welcher Tag für die Gletschertour? Pizza oder Knödel? – Frage stellen, alle stimmen auf ihrem Gerät ab.') }}
    </p>
  </div>

  <PollCard
    v-for="p in sorted"
    :key="p.id"
    :poll="p"
    :votes="votesOf(p.id)"
    :voter="voter"
    :participants="participants"
    :today="today"
    :editable="editable"
    :activity-title="activityTitle"
    :adopted="adopted(p)"
    @vote="(c) => pollRepository.setVote(p, voter, c)"
    @close="(c) => pollRepository.setClosed(p.id, c)"
    @remove="remove(p)"
    @adopt="adopt(p)"
  />
</template>
