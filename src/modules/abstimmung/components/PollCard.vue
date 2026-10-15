<script setup lang="ts">
import { computed } from 'vue'
import { formatDate } from '@/core/format'
import { isOpen, missingVoters, optionLabel, tally, toggleChoice, winners } from '../logic'
import { KIND_LABELS, type Poll, type PollVote } from '../types'

const props = defineProps<{
  poll: Poll
  votes: PollVote[]
  /** Ich stimme ab als … (leer = noch nicht gewählt) */
  voter: string
  participants: string[]
  today: string
  editable: boolean
  activityTitle: (id: string) => string
  /** Ist das Ergebnis schon bei der Unternehmung eingetragen? */
  adopted: boolean
}>()
const emit = defineEmits<{ vote: [choices: string[] | null]; close: [closed: boolean]; remove: []; adopt: [] }>()

const open = computed(() => isOpen(props.poll, props.today))
const result = computed(() => tally(props.poll, props.votes, props.participants))
const mine = computed(() => props.votes.find((v) => v.voter === props.voter)?.choices ?? null)
const missing = computed(() => missingVoters(props.participants, props.votes))
const win = computed(() => winners(props.poll, props.votes))
/** Ergebnis lässt sich bei der Unternehmung eintragen (eindeutiger Gewinner) */
const canAdopt = computed(
  () => !open.value && props.editable && win.value.length === 1 && ((props.poll.kind === 'termin' && !!props.poll.activityId && !!win.value[0].date) || (props.poll.kind === 'unternehmung' && !!win.value[0].activityId))
)
const label = (o: Poll['options'][number]) => optionLabel(o, props.activityTitle)

function tap(optionId: string) {
  if (!open.value || !props.voter) return
  const next = toggleChoice(mine.value ?? [], optionId, props.poll.multiple)
  emit('vote', next.length ? next : null)
}
</script>

<template>
  <article class="card mb-3" :class="{ 'poll-closed': !open }" data-poll>
    <div class="card-body">
      <div class="d-flex align-items-start gap-2">
        <i :class="`bi bi-${KIND_LABELS[poll.kind].icon} fs-4 text-primary`" aria-hidden="true"></i>
        <div class="flex-grow-1">
          <h2 class="h5 mb-0">{{ poll.question }}</h2>
          <div class="small text-body-secondary">
            <template v-if="!open">{{ t('Beendet') }}</template>
            <template v-else-if="poll.deadline">{{ t('Abstimmen bis {deadline}', { deadline: formatDate(poll.deadline) }) }}</template>
            <template v-else>{{ t('Offen') }}</template>
            · {{ poll.multiple ? 'mehrere Antworten möglich' : 'eine Antwort' }}
            <template v-if="poll.createdBy"> {{ t('· von {createdBy}', { createdBy: poll.createdBy }) }}</template>
            <template v-if="poll.kind === 'termin' && poll.activityId"> {{ t('· für „{activityTitle}“', { activityTitle: activityTitle(poll.activityId) }) }}</template>
          </div>
        </div>
        <div v-if="editable" class="dropdown">
          <button type="button" class="btn btn-sm btn-outline-secondary" data-bs-toggle="dropdown" aria-expanded="false" :aria-label="`Mehr zu „${poll.question}“`">
            <i class="bi bi-three-dots" aria-hidden="true"></i>
          </button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><RouterLink class="dropdown-item" :to="`/trip/${poll.tripId}/abstimmungen/${poll.id}`"><i class="bi bi-pencil me-2" aria-hidden="true"></i>{{ t('Bearbeiten') }}</RouterLink></li>
            <li v-if="!poll.closed"><button type="button" class="dropdown-item" @click="emit('close', true)"><i class="bi bi-stop-circle me-2" aria-hidden="true"></i>{{ t('Abstimmung beenden') }}</button></li>
            <li v-else><button type="button" class="dropdown-item" @click="emit('close', false)"><i class="bi bi-play-circle me-2" aria-hidden="true"></i>{{ t('Wieder öffnen') }}</button></li>
            <li><button type="button" class="dropdown-item text-danger" @click="emit('remove')"><i class="bi bi-trash me-2" aria-hidden="true"></i>{{ t('Löschen') }}</button></li>
          </ul>
        </div>
      </div>
      <p v-if="poll.note" class="small mt-2 mb-0 pre">{{ poll.note }}</p>

      <div class="mt-3 d-grid gap-2" role="group" :aria-label="poll.question">
        <button
          v-for="r in result.results"
          :key="r.option.id"
          type="button"
          class="option btn text-start position-relative overflow-hidden"
          :class="[mine?.includes(r.option.id) ? 'btn-outline-primary chosen' : 'btn-outline-secondary', { leading: r.leading && !open }]"
          :disabled="!open || !voter"
          :aria-pressed="mine?.includes(r.option.id) ?? false"
          data-option
          @click="tap(r.option.id)"
        >
          <span class="bar" :style="{ width: `${Math.round(r.share * 100)}%` }" aria-hidden="true"></span>
          <span class="position-relative d-flex align-items-center gap-2">
            <i class="bi" :class="mine?.includes(r.option.id) ? (poll.multiple ? 'bi-check-square-fill' : 'bi-check-circle-fill') : poll.multiple ? 'bi-square' : 'bi-circle'" aria-hidden="true"></i>
            <span class="flex-grow-1">
              {{ label(r.option) }}
              <span v-if="r.voters.length" class="d-block small text-body-secondary">{{ r.voters.join(', ') }}</span>
            </span>
            <i v-if="r.leading && !open" class="bi bi-trophy-fill text-warning" :aria-label="t('vorne')"></i>
            <span class="badge rounded-pill text-bg-light border" data-count>{{ r.count }}</span>
          </span>
        </button>
      </div>

      <div class="small mt-2 d-flex flex-wrap gap-2 align-items-center">
        <span>{{ result.voters.length }} {{ result.voters.length === 1 ? 'Stimme' : 'Stimmen' }}</span>
        <span v-if="open && missing.length" class="text-body-secondary" data-missing>{{ t('· noch offen: {join}', { join: missing.join(', ') }) }}</span>
        <button v-if="open && mine" type="button" class="btn btn-link btn-sm p-0 ms-auto" @click="emit('vote', null)">{{ t('Stimme zurückziehen') }}</button>
      </div>

      <div v-if="!open && win.length" class="alert alert-success small py-2 mt-3 mb-0 d-flex flex-wrap align-items-center gap-2" data-result>
        <i class="bi bi-trophy" aria-hidden="true"></i>
        <span>{{ win.length === 1 ? 'Ergebnis' : 'Gleichstand' }}: <strong>{{ win.map(label).join(' / ') }}</strong></span>
        <span v-if="adopted" class="ms-auto"><i class="bi bi-check2 me-1" aria-hidden="true"></i>{{ t('eingetragen') }}</span>
        <button v-else-if="canAdopt" type="button" class="btn btn-sm btn-success ms-auto" data-adopt @click="emit('adopt')">
          {{ poll.kind === 'termin' ? 'Tag bei der Unternehmung eintragen' : 'Als geplant übernehmen' }}
        </button>
      </div>
    </div>
  </article>
</template>

<style scoped>
.option {
  min-height: 2.75rem;
}
.option {
  color: var(--bs-body-color);
}
.option .bar {
  position: absolute;
  inset: 0 auto 0 0;
  background: color-mix(in srgb, var(--bs-secondary-color) 14%, transparent);
  transition: width 0.3s;
}
.option.chosen {
  border-width: 2px;
  border-color: var(--bs-primary);
}
.option.chosen .bar {
  background: color-mix(in srgb, var(--bs-primary) 22%, transparent);
}
.option.chosen .bi:first-child {
  color: var(--bs-primary);
}
.option:disabled {
  opacity: 1;
}
.option.leading {
  border-color: var(--bs-success);
}
.poll-closed .option.leading .bar {
  background: var(--bs-success-bg-subtle);
}
.pre {
  white-space: pre-line;
}
</style>
