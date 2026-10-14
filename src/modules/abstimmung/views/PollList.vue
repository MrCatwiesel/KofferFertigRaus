<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useLiveQuery } from '@/core/composables'
import { newId } from '@/core/db'
import { todayIso } from '@/core/dates'
import { formatDate } from '@/core/format'
import { getMeta, setMeta } from '@/core/meta'
import { canEdit, myParticipant, people } from '@/core/people'
import { TripContextHeader, participantsOf, tripRepository, type Trip } from '@/modules/trip/public'
import { activityRepository, type Activity } from '@/modules/activity/public'
import { pollRepository, voteRepository } from '../repository'
import { isOpen, missingVoters, optionsFromLines, tally, toggleChoice } from '../logic'
import type { Poll, PollVote } from '../types'
import { t } from '@/core/i18n'

const props = defineProps<{ tripId: string }>()
const today = todayIso()
const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const polls = useLiveQuery(() => pollRepository.listByTrip(props.tripId), [] as Poll[])
const votes = useLiveQuery(() => voteRepository.listByTrip(props.tripId), [] as PollVote[])
const activities = useLiveQuery(() => activityRepository.listByTrip(props.tripId), [] as Activity[])

const editable = computed(() => canEdit(props.tripId))
const participants = computed(() => participantsOf(trip.value))

// Wer stimmt ab? Person mit Konto: fest (verknüpfter Teilnehmer oder eigener Name). Sonst auf diesem Gerät gewählt.
const META_ME = `abstimmung.ich.${props.tripId}`
const chosen = ref('')
void getMeta(META_ME, '').then((v) => (chosen.value = v))
watch(chosen, (v) => void setMeta(META_ME, v))
const me = computed(() => {
  if (people.me) return { name: myParticipant(people, trip.value?.memberLinks) || people.me.name, memberId: people.me.id as string | null, fixed: true }
  return { name: chosen.value, memberId: null as string | null, fixed: false }
})

const sorted = computed(() =>
  [...polls.value].sort((a, b) => Number(!isOpen(a, today)) - Number(!isOpen(b, today)) || b.createdAt.localeCompare(a.createdAt))
)
const resultOf = (p: Poll) => tally(p, votes.value)
const myChoices = (p: Poll) => votes.value.find((v) => v.pollId === p.id && v.voter === me.value.name)?.choices ?? []
const missing = (p: Poll) => missingVoters(p, votes.value, participants.value)
const activityOf = (id?: string) => (id ? activities.value.find((a) => a.id === id) : undefined)

async function vote(p: Poll, optionId: string) {
  if (!isOpen(p, today) || !me.value.name) return
  await voteRepository.set(p, me.value.name, me.value.memberId, toggleChoice(myChoices(p), optionId, p.multiple))
}

// ---- Neue Abstimmung
const showForm = ref(false)
const form = reactive({ question: '', lines: '', ideas: [] as string[], multiple: false, deadline: '', notes: '' })
const formError = ref('')
const ideas = computed(() => activities.value.filter((a) => a.status === 'idee' || a.status === 'geplant'))

async function create() {
  formError.value = ''
  const options = [
    ...optionsFromLines(form.lines, newId),
    ...form.ideas.flatMap((id) => {
      const a = activityOf(id)
      return a ? [{ id: newId(), text: a.title, activityId: a.id }] : []
    })
  ]
  if (!form.question.trim()) return void (formError.value = t('Bitte eine Frage eingeben.'))
  if (options.length < 2) return void (formError.value = t('Bitte mindestens zwei Antworten angeben.'))
  await pollRepository.create(props.tripId, { question: form.question.trim(), notes: form.notes.trim(), options, multiple: form.multiple, deadline: form.deadline }, me.value.name || people.me?.name || '')
  Object.assign(form, { question: '', lines: '', ideas: [], multiple: false, deadline: '', notes: '' })
  showForm.value = false
}

// ---- Verwalten
const newOption = reactive<Record<string, string>>({})
async function addOption(p: Poll) {
  const text = (newOption[p.id] ?? '').trim()
  if (!text || p.options.some((o) => o.text.toLowerCase() === text.toLowerCase())) return
  // Kopien statt Vue-Proxys (IndexedDB kann Proxys nicht speichern)
  await pollRepository.update(p.id, { options: [...p.options.map((o) => ({ ...o })), { id: newId(), text: text.slice(0, 200) }] })
  newOption[p.id] = ''
}
const setClosed = (p: Poll, closed: boolean) => pollRepository.update(p.id, { closed })
async function remove(p: Poll) {
  if (confirm(t('Abstimmung „{0}“ samt allen Stimmen löschen?', [p.question]))) await pollRepository.remove(p.id)
}
async function restart(p: Poll) {
  if (confirm(t('Alle Stimmen löschen und neu abstimmen?'))) {
    await voteRepository.clear(p.id)
    await pollRepository.update(p.id, { closed: false })
  }
}
/** Gewinner ist eine Idee → als geplant übernehmen */
const winnerActivities = (p: Poll) =>
  resultOf(p)
    .results.filter((r) => r.leading)
    .map((r) => activityOf(r.option.activityId))
    .filter((a): a is Activity => !!a && a.status === 'idee')
const plan = (a: Activity) => activityRepository.setStatus(a.id, 'geplant')
const pct = (x: number) => `${Math.round(x * 100)} %`
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="$t('Abstimmungen')" />

  <!-- Wer stimmt ab? -->
  <div v-if="!me.fixed" class="d-flex flex-wrap align-items-center gap-2 mb-3" data-poll-me>
    <label for="poll-me" class="small fw-semibold">{{ $t('Ich stimme ab als') }}</label>
    <select v-if="participants.length" id="poll-me" v-model="chosen" class="form-select form-select-sm w-auto">
      <option value="">{{ $t('– bitte wählen –') }}</option>
      <option v-for="p in participants" :key="p" :value="p">{{ p }}</option>
    </select>
    <input v-else id="poll-me" v-model.lazy.trim="chosen" class="form-control form-control-sm w-auto" :placeholder="$t('Dein Name')" />
    <span class="small text-body-secondary">{{ $t('(auf diesem Gerät gemerkt)') }}</span>
  </div>
  <p v-else class="small text-body-secondary mb-3"><i class="bi bi-person-check me-1" aria-hidden="true"></i>{{ $t('Du stimmst ab als') }} <strong>{{ me.name }}</strong>.</p>

  <button v-if="editable && !showForm" type="button" class="btn btn-primary mb-3" data-poll-new @click="showForm = true">
    <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>{{ $t('Neue Abstimmung') }}
  </button>

  <form v-if="showForm" class="card mb-3" data-poll-form @submit.prevent="create">
    <div class="card-body">
      <h2 class="h6">{{ $t('Neue Abstimmung') }}</h2>
      <div class="mb-2">
        <label for="poll-q" class="form-label small">{{ $t('Frage') }}</label>
        <input id="poll-q" v-model="form.question" class="form-control" maxlength="200" :placeholder="$t('z. B. Wohin am Samstag?')" required />
      </div>
      <div class="mb-2">
        <label for="poll-lines" class="form-label small">{{ $t('Antworten – eine pro Zeile') }}</label>
        <textarea id="poll-lines" v-model="form.lines" class="form-control" rows="4" :placeholder="$t('Bergsee\nAltstadt\nTherme')"></textarea>
      </div>
      <details v-if="ideas.length" class="mb-2 small">
        <summary>{{ $t('Unternehmungen zur Wahl stellen ({0})', [ideas.length]) }}</summary>
        <div v-for="a in ideas" :key="a.id" class="form-check mt-1">
          <input :id="`idea-${a.id}`" v-model="form.ideas" class="form-check-input" type="checkbox" :value="a.id" />
          <label class="form-check-label" :for="`idea-${a.id}`">{{ a.title }}</label>
        </div>
      </details>
      <div class="row g-2 mb-2">
        <div class="col-sm-6 d-flex align-items-center">
          <div class="form-check form-switch mb-0">
            <input id="poll-multi" v-model="form.multiple" class="form-check-input" type="checkbox" role="switch" />
            <label class="form-check-label small" for="poll-multi">{{ $t('Mehrere Antworten erlaubt') }}</label>
          </div>
        </div>
        <div class="col-sm-6">
          <label for="poll-deadline" class="form-label small mb-0">{{ $t('Abstimmen bis (optional)') }}</label>
          <input id="poll-deadline" v-model="form.deadline" type="date" class="form-control form-control-sm" />
        </div>
      </div>
      <div class="mb-2">
        <label for="poll-notes" class="form-label small">{{ $t('Hinweis (optional)') }}</label>
        <input id="poll-notes" v-model="form.notes" class="form-control form-control-sm" maxlength="500" />
      </div>
      <div v-if="formError" class="alert alert-danger py-1 small">{{ formError }}</div>
      <div class="d-flex gap-2">
        <button type="submit" class="btn btn-primary">{{ $t('Abstimmung starten') }}</button>
        <button type="button" class="btn btn-outline-secondary" @click="showForm = false">{{ $t('Abbrechen') }}</button>
      </div>
    </div>
  </form>

  <p v-if="!polls.length && !showForm" class="text-body-secondary on-bg">
    {{ $t('Gemeinsam entscheiden: Wohin am Samstag? Welches Restaurant? Welche Unterkunft? – Alle Mitreisenden stimmen auf ihrem Gerät ab, das Ergebnis sehen alle sofort.') }}
  </p>

  <section v-for="p in sorted" :key="p.id" class="card mb-3" :class="{ 'border-primary': isOpen(p, today) }" data-poll>
    <div class="card-body">
      <h2 class="h5 mb-1">{{ p.question }}</h2>
      <div class="small text-body-secondary mb-2 d-flex flex-wrap gap-2">
        <span v-if="!isOpen(p, today)" class="badge text-bg-secondary">{{ $t('beendet') }}</span>
        <span v-else class="badge text-bg-primary">{{ $t('offen') }}</span>
        <span v-if="p.multiple">{{ $t('Mehrere Antworten möglich') }}</span>
        <span v-if="p.deadline">{{ $t('bis {0}', [formatDate(p.deadline)]) }}</span>
        <span v-if="p.createdBy">{{ $t('von {0}', [p.createdBy]) }}</span>
      </div>
      <p v-if="p.notes" class="small mb-2">{{ p.notes }}</p>

      <div class="list-group mb-2">
        <button v-for="r in resultOf(p).results" :key="r.option.id" type="button" class="list-group-item list-group-item-action option"
                :class="{ chosen: myChoices(p).includes(r.option.id) }" :disabled="!isOpen(p, today) || !me.name"
                :aria-pressed="myChoices(p).includes(r.option.id)" data-poll-option @click="vote(p, r.option.id)">
          <div class="d-flex align-items-center gap-2">
            <i class="bi" :class="myChoices(p).includes(r.option.id) ? (p.multiple ? 'bi-check-square-fill' : 'bi-check-circle-fill') + ' text-primary' : p.multiple ? 'bi-square' : 'bi-circle'" aria-hidden="true"></i>
            <span class="flex-grow-1 text-start">
              {{ r.option.text }}
              <i v-if="r.option.activityId" class="bi bi-star text-body-secondary ms-1" :title="$t('Unternehmung')" aria-hidden="true"></i>
              <i v-if="r.leading && resultOf(p).voters.length" class="bi bi-trophy-fill text-warning ms-1" title="vorne" aria-hidden="true"></i>
            </span>
            <span class="badge text-bg-light border">{{ r.count }}</span>
          </div>
          <div class="progress mt-1" role="progressbar" :aria-label="`${r.option.text}: ${pct(r.share)}`" :aria-valuenow="Math.round(r.share * 100)" aria-valuemin="0" aria-valuemax="100" style="height: 4px">
            <div class="progress-bar" :style="{ width: `${Math.round(r.share * 100)}%` }"></div>
          </div>
          <div v-if="r.voters.length" class="small text-body-secondary text-start mt-1">{{ r.voters.join(', ') }}</div>
        </button>
      </div>

      <div v-if="isOpen(p, today) && editable" class="input-group input-group-sm mb-2">
        <input v-model="newOption[p.id]" class="form-control" :placeholder="$t('Weitere Antwort')" maxlength="200" :aria-label="`Weitere Antwort für ${p.question}`" @keydown.enter.prevent="addOption(p)" />
        <button type="button" class="btn btn-outline-secondary" @click="addOption(p)">{{ $t('Hinzufügen') }}</button>
      </div>

      <div class="small text-body-secondary mb-2" data-poll-status>
        {{ resultOf(p).voters.length }} {{ resultOf(p).voters.length === 1 ? $t('Stimme') : $t('Stimmen') }}
        <template v-if="isOpen(p, today) && participants.length && missing(p).length"> {{ $t('· fehlt noch: {0}', [missing(p).join(', ')]) }}</template>
        <template v-else-if="isOpen(p, today) && participants.length"> {{ $t('· alle haben abgestimmt') }}</template>
        <template v-if="isOpen(p, today) && !me.name"> {{ $t('· zum Abstimmen oben deinen Namen wählen') }}</template>
      </div>

      <div v-if="!isOpen(p, today)" class="mb-2">
        <button v-for="a in winnerActivities(p)" :key="a.id" type="button" class="btn btn-sm btn-success me-2 mb-1" :disabled="!editable" @click="plan(a)">
          <i class="bi bi-calendar-check me-1" aria-hidden="true"></i>{{ $t('„{0}“ einplanen', [a.title]) }}
        </button>
      </div>

      <div v-if="editable" class="d-flex flex-wrap gap-2">
        <button v-if="!p.closed" type="button" class="btn btn-sm btn-outline-secondary" data-poll-close @click="setClosed(p, true)">{{ $t('Beenden') }}</button>
        <button v-else type="button" class="btn btn-sm btn-outline-secondary" @click="setClosed(p, false)">{{ $t('Wieder öffnen') }}</button>
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="restart(p)">{{ $t('Neu abstimmen') }}</button>
        <button type="button" class="btn btn-sm btn-outline-danger ms-auto" @click="remove(p)"><i class="bi bi-trash" aria-hidden="true"></i><span class="visually-hidden">{{ $t('Löschen') }}</span></button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.option.chosen {
  background-color: var(--bs-primary-bg-subtle);
}
.option:disabled {
  opacity: 1;
  color: var(--bs-body-color);
}
</style>
