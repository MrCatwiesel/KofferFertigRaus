<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useLiveQuery } from '@/core/composables'
import { eachDay } from '@/core/dates'
import { getMeta } from '@/core/meta'
import { myParticipant, people } from '@/core/people'
import { activityRepository, type Activity } from '@/modules/activity/public'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import { dayLabel, emptyPollDraft, newOption, usableOptions, validatePoll } from '../logic'
import { pollRepository } from '../repository'
import { KIND_LABELS, type PollDraft, type PollKind } from '../types'

const props = defineProps<{ tripId: string; pollId?: string }>()
const router = useRouter()
const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const activities = useLiveQuery(() => activityRepository.listByTrip(props.tripId), [] as Activity[])
const draft = reactive<PollDraft>(emptyPollDraft())
const submitted = ref(false)
const saving = ref(false)
const isEdit = computed(() => !!props.pollId)
const errors = computed(() => validatePoll(draft))

onMounted(async () => {
  if (props.pollId) {
    const p = await pollRepository.get(props.pollId)
    if (!p) return router.replace(`/trip/${props.tripId}/abstimmungen`)
    const { id: _i, tripId: _t, createdAt: _c, updatedAt: _u, ...rest } = p
    Object.assign(draft, JSON.parse(JSON.stringify(rest)))
    return
  }
  const t = await tripRepository.get(props.tripId)
  draft.createdBy = myParticipant(people, t?.memberLinks) || (await getMeta(`abstimmung.ich.${props.tripId}`, ''))
})

/** Ideen und Geplantes – Verworfenes nicht */
const choosable = computed(() => activities.value.filter((a) => a.status !== 'verworfen').sort((a, b) => a.title.localeCompare(b.title, 'de')))
const tripDates = computed(() => (trip.value?.startDate && trip.value.endDate ? eachDay(trip.value.startDate, trip.value.endDate) : []))

function setKind(kind: PollKind) {
  if (draft.kind === kind) return
  draft.kind = kind
  // Antworten passend vorbereiten; schon Eingetragenes der anderen Art fällt weg
  if (kind === 'termin') {
    draft.options = tripDates.value.slice(0, 14).map((date) => newOption({ date }))
    if (draft.options.length < 2) draft.options = [newOption(), newOption()]
    draft.multiple = true
  } else if (kind === 'unternehmung') {
    draft.options = []
    draft.multiple = false
  } else {
    draft.options = [newOption(), newOption()]
    draft.multiple = false
    draft.activityId = undefined
  }
}

const chosenActivity = (id: string) => draft.options.some((o) => o.activityId === id)
function toggleActivity(a: Activity) {
  draft.options = chosenActivity(a.id) ? draft.options.filter((o) => o.activityId !== a.id) : [...draft.options, newOption({ activityId: a.id })]
}

async function save() {
  submitted.value = true
  if (Object.keys(errors.value).length) return
  saving.value = true
  try {
    const plain: PollDraft = { ...draft, question: draft.question.trim(), options: usableOptions(draft).map((o) => ({ ...o, text: o.text.trim() })) }
    if (props.pollId) await pollRepository.update(props.pollId, plain)
    else await pollRepository.create(props.tripId, plain)
    router.push(`/trip/${props.tripId}/abstimmungen`)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="isEdit ? t('Abstimmung bearbeiten') : t('Neue Abstimmung')" />

  <form class="card" novalidate @submit.prevent="save">
    <div class="card-body">
      <div class="mb-3">
        <span class="form-label d-block">{{ t('Art') }}</span>
        <div class="d-grid gap-2 kinds">
          <button
            v-for="(k, key) in KIND_LABELS"
            :key="key"
            type="button"
            class="btn text-start"
            :class="draft.kind === key ? 'btn-primary' : 'btn-outline-secondary'"
            :aria-pressed="draft.kind === key"
            :data-kind="key"
            @click="setKind(key)"
          >
            <i :class="`bi bi-${k.icon} me-2`" aria-hidden="true"></i><strong>{{ k.label }}</strong>
            <span class="d-block small opacity-75">{{ k.hint }}</span>
          </button>
        </div>
      </div>

      <div class="mb-3">
        <label for="question" class="form-label">{{ t('Frage') }}</label>
        <input
          id="question"
          v-model="draft.question"
          class="form-control"
          :class="{ 'is-invalid': submitted && errors.question }"
          :placeholder="draft.kind === 'termin' ? t('Welcher Tag passt für die Gletschertour?') : draft.kind === 'unternehmung' ? t('Was machen wir am Sonntag?') : t('Wo essen wir heute Abend?')"
          maxlength="200"
        />
        <div class="invalid-feedback">{{ errors.question }}</div>
      </div>

      <!-- Antworten -->
      <fieldset class="mb-3">
        <legend class="form-label fs-6">{{ draft.kind === 'termin' ? t('Tage') : draft.kind === 'unternehmung' ? t('Unternehmungen') : t('Antworten') }}</legend>

        <template v-if="draft.kind === 'unternehmung'">
          <p v-if="!choosable.length" class="small text-body-secondary">
            {{ t('Noch keine Unternehmungen – erst unter') }} <RouterLink :to="`/trip/${tripId}/unternehmungen`">{{ t('Unternehmungen') }}</RouterLink> {{ t('Ideen sammeln.') }}
          </p>
          <div v-for="a in choosable" :key="a.id" class="form-check">
            <input :id="`act-${a.id}`" class="form-check-input" type="checkbox" :checked="chosenActivity(a.id)" @change="toggleActivity(a)" />
            <label class="form-check-label" :for="`act-${a.id}`">{{ a.title }} <span v-if="a.plannedDate" class="small text-body-secondary">· {{ dayLabel(a.plannedDate) }}</span></label>
          </div>
        </template>

        <template v-else>
          <div v-for="(o, i) in draft.options" :key="o.id" class="input-group mb-2" data-option-row>
            <input v-if="draft.kind === 'termin'" v-model="o.date" type="date" class="form-control flex-grow-0 w-auto" :aria-label="t('Tag {x}', { x: i + 1 })" :min="trip?.startDate" />
            <input
              v-model="o.text"
              class="form-control"
              :placeholder="draft.kind === 'termin' ? t('Zusatz, z. B. vormittags (optional)') : t('Antwort {x}', { x: i + 1 })"
              :aria-label="draft.kind === 'termin' ? t('Zusatz zu Tag {x}', { x: i + 1 }) : t('Antwort {x}', { x: i + 1 })"
              maxlength="120"
            />
            <button type="button" class="btn btn-outline-secondary" :aria-label="t('Antwort {x} entfernen', { x: i + 1 })" @click="draft.options.splice(i, 1)">
              <i class="bi bi-x-lg" aria-hidden="true"></i>
            </button>
          </div>
          <button type="button" class="btn btn-sm btn-outline-primary" data-add-option @click="draft.options.push(newOption())">
            <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>{{ draft.kind === 'termin' ? t('Tag hinzufügen') : t('Antwort hinzufügen') }}
          </button>
        </template>
        <div v-if="submitted && errors.options" class="text-danger small mt-1">{{ errors.options }}</div>
      </fieldset>

      <div v-if="draft.kind === 'termin' && choosable.length" class="mb-3">
        <label for="activity" class="form-label">{{ t('Für eine Unternehmung?') }} <span class="text-body-secondary small">{{ t('(optional)') }}</span></label>
        <select id="activity" v-model="draft.activityId" class="form-select">
          <option :value="undefined">{{ t('– nein –') }}</option>
          <option v-for="a in choosable" :key="a.id" :value="a.id">{{ a.title }}</option>
        </select>
        <div class="form-text">{{ t('Nach dem Abstimmen lässt sich der gewählte Tag dort mit einem Tipp eintragen.') }}</div>
      </div>

      <div class="form-check form-switch mb-3">
        <input id="multiple" v-model="draft.multiple" class="form-check-input" type="checkbox" />
        <label class="form-check-label" for="multiple">{{ t('Mehrere Antworten erlaubt') }}</label>
      </div>

      <div class="row g-3 mb-3">
        <div class="col-sm-6">
          <label for="deadline" class="form-label">{{ t('Abstimmen bis') }} <span class="text-body-secondary small">{{ t('(optional)') }}</span></label>
          <input id="deadline" v-model="draft.deadline" type="date" class="form-control" />
          <div class="form-text">{{ t('Erscheint unter Termine & Fristen.') }}</div>
        </div>
      </div>

      <div class="mb-3">
        <label for="note" class="form-label">{{ t('Hinweis') }} <span class="text-body-secondary small">{{ t('(optional)') }}</span></label>
        <textarea id="note" v-model="draft.note" class="form-control" rows="2" maxlength="1000"></textarea>
      </div>

      <div class="d-flex gap-2">
        <button type="submit" class="btn btn-primary" :disabled="saving">{{ isEdit ? t('Speichern') : t('Abstimmung starten') }}</button>
        <RouterLink :to="`/trip/${tripId}/abstimmungen`" class="btn btn-outline-secondary">{{ t('Abbrechen') }}</RouterLink>
      </div>
    </div>
  </form>
</template>

<style scoped>
@media (min-width: 576px) {
  .kinds {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
