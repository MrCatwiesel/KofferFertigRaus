<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatMoney } from '@/core/format'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import { activityRepository } from '../repository'
import { emptyActivityDraft, estimatedCost, validateActivity } from '../logic'
import { ACTIVITY_STATUS, CATEGORY, PRIORITY, SETTING, type ActivityDraft } from '../types'

const props = defineProps<{ tripId: string; id?: string }>()
const router = useRouter()

const draft = reactive<ActivityDraft>(emptyActivityDraft())
const trip = ref<Trip>()
const submitted = ref(false)
const saving = ref(false)
const listPath = computed(() => `/trip/${props.tripId}/unternehmungen`)

onMounted(async () => {
  trip.value = await tripRepository.get(props.tripId)
  if (!trip.value) return router.replace('/trip')
  if (props.id) {
    const item = await activityRepository.get(props.id)
    if (!item) return router.replace(listPath.value)
    const { id: _i, tripId: _t, createdAt: _c, updatedAt: _u, ...rest } = item
    Object.assign(draft, rest)
  } else {
    Object.assign(draft, emptyActivityDraft(trip.value.currency))
  }
})

/** Leere Zahlenfelder liefern "" – in null umwandeln. */
const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : null)

const errors = computed(() =>
  validateActivity({ ...draft, durationHours: num(draft.durationHours), pricePerPerson: num(draft.pricePerPerson) }, trip.value)
)
const costInfo = computed(() => {
  const p = num(draft.pricePerPerson)
  if (!p || !trip.value) return null
  return `ca. ${formatMoney(estimatedCost({ pricePerPerson: p }, trip.value.travelers), draft.currency)} für ${trip.value.travelers} ${trip.value.travelers === 1 ? 'Person' : 'Personen'}`
})

function invalid(f: keyof ActivityDraft) {
  return submitted.value && !!errors.value[f]
}

/** Ein geplanter Tag macht aus einer Idee automatisch "geplant". */
function onDateChange() {
  if (draft.plannedDate && draft.status === 'idee') draft.status = 'geplant'
}

async function save() {
  submitted.value = true
  if (Object.keys(errors.value).length) return
  saving.value = true
  try {
    const plain: ActivityDraft = {
      ...draft,
      title: draft.title.trim(),
      url: draft.url.trim(),
      durationHours: num(draft.durationHours),
      pricePerPerson: num(draft.pricePerPerson)
    }
    if (props.id) await activityRepository.update(props.id, plain)
    else await activityRepository.create(props.tripId, plain)
    router.push(listPath.value)
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!props.id || !confirm(`„${draft.title}“ löschen?`)) return
  await activityRepository.remove(props.id)
  router.replace(listPath.value)
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="id ? 'Unternehmung bearbeiten' : 'Neue Unternehmung'" />

  <form class="row g-3" novalidate @submit.prevent="save">
    <div class="col-12">
      <label for="title" class="form-label">{{ t('Was?') }}</label>
      <input id="title" v-model="draft.title" class="form-control" :class="{ 'is-invalid': invalid('title') }"
             :placeholder="t('z. B. Bootsfahrt nach Limone')" />
      <div class="invalid-feedback">{{ errors.title }}</div>
    </div>

    <div class="col-6">
      <label for="cat" class="form-label">{{ t('Kategorie') }}</label>
      <select id="cat" v-model="draft.category" class="form-select">
        <option v-for="(c, key) in CATEGORY" :key="key" :value="key">{{ c.label }}</option>
      </select>
    </div>
    <div class="col-6">
      <label for="setting" class="form-label">{{ t('Drinnen / draußen') }}</label>
      <select id="setting" v-model="draft.setting" class="form-select">
        <option v-for="(s, key) in SETTING" :key="key" :value="key">{{ s.label }}</option>
      </select>
    </div>

    <div class="col-12">
      <label class="form-label d-block">{{ t('Wie wichtig?') }}</label>
      <div class="btn-group" role="group" :aria-label="t('Priorität')">
        <template v-for="p in ([1, 2, 3] as const)" :key="p">
          <input :id="`prio-${p}`" v-model="draft.priority" type="radio" class="btn-check" :value="p" />
          <label class="btn btn-outline-warning" :for="`prio-${p}`">{{ PRIORITY[p] }}</label>
        </template>
      </div>
    </div>

    <div class="col-12">
      <label class="form-label d-block">{{ t('Status') }}</label>
      <div class="btn-group flex-wrap" role="group" :aria-label="t('Status')">
        <template v-for="(s, key) in ACTIVITY_STATUS" :key="key">
          <input :id="`st-${key}`" v-model="draft.status" type="radio" class="btn-check" :value="key" />
          <label class="btn btn-outline-primary" :for="`st-${key}`">{{ s.label }}</label>
        </template>
      </div>
    </div>

    <div class="col-12 col-md-6">
      <label for="date" class="form-label">{{ t('Geplanter Tag') }}</label>
      <input id="date" v-model="draft.plannedDate" type="date" class="form-control"
             :min="trip?.startDate" :max="trip?.endDate" :class="{ 'is-invalid': invalid('plannedDate') }"
             @change="onDateChange" />
      <div class="invalid-feedback">{{ errors.plannedDate }}</div>
      <div class="form-text">{{ t('Leer lassen, wenn noch offen – der Tagesplaner hilft später beim Einplanen.') }}</div>
    </div>
    <div class="col-12 col-md-6">
      <label for="dur" class="form-label">{{ t('Dauer (Stunden)') }}</label>
      <input id="dur" v-model.number="draft.durationHours" type="number" min="0.5" step="0.5" class="form-control"
             :class="{ 'is-invalid': invalid('durationHours') }" :placeholder="t('optional')" />
      <div class="invalid-feedback">{{ errors.durationHours }}</div>
    </div>

    <div class="col-12 col-md-6">
      <label for="price" class="form-label">{{ t('Preis pro Person') }}</label>
      <div class="input-group has-validation">
        <input id="price" v-model.number="draft.pricePerPerson" type="number" min="0" step="0.5" class="form-control"
               :class="{ 'is-invalid': invalid('pricePerPerson') }" :placeholder="t('optional')" />
        <select v-model="draft.currency" class="form-select flex-grow-0 w-auto" :aria-label="t('Währung')">
          <option>{{ t('EUR') }}</option><option>{{ t('CHF') }}</option><option>{{ t('USD') }}</option><option>{{ t('GBP') }}</option>
        </select>
        <div class="invalid-feedback">{{ errors.pricePerPerson }}</div>
      </div>
      <div v-if="costInfo" class="form-text">{{ costInfo }}</div>
    </div>
    <div class="col-12 col-md-6 d-flex align-items-end">
      <div class="form-check form-switch mb-2">
        <input id="booking" v-model="draft.bookingRequired" class="form-check-input" type="checkbox" role="switch" />
        <label class="form-check-label" for="booking">{{ t('Reservierung / Ticket nötig') }}</label>
      </div>
    </div>

    <div class="col-12 col-md-6">
      <label for="place" class="form-label">{{ t('Ort / Adresse') }}</label>
      <input id="place" v-model="draft.place" class="form-control" autocomplete="off" />
    </div>
    <div class="col-12 col-md-6">
      <label for="hours" class="form-label">{{ t('Öffnungszeiten') }}</label>
      <input id="hours" v-model="draft.openingHours" class="form-control" :placeholder="t('z. B. Di–So 10–18 Uhr')" />
    </div>
    <div class="col-12">
      <label for="url" class="form-label">{{ t('Link') }}</label>
      <input id="url" v-model="draft.url" type="url" class="form-control" :placeholder="t('https://…')" />
    </div>
    <div class="col-12">
      <label for="notes" class="form-label">{{ t('Notizen') }}</label>
      <textarea id="notes" v-model="draft.notes" rows="3" class="form-control"
                :placeholder="t('Tipps, Anfahrt, was mitnehmen …')"></textarea>
    </div>

    <div class="col-12 d-flex gap-2">
      <button type="submit" class="btn btn-primary" :disabled="saving">
        <i class="bi bi-check-lg me-1" aria-hidden="true"></i>{{ t('Speichern') }}
      </button>
      <RouterLink :to="`/trip/${tripId}/unternehmungen`" class="btn btn-outline-secondary">{{ t('Abbrechen') }}</RouterLink>
      <button v-if="id" type="button" class="btn btn-outline-danger ms-auto" @click="remove">
        <i class="bi bi-trash me-1" aria-hidden="true"></i>{{ t('Löschen') }}
      </button>
    </div>
  </form>
</template>
