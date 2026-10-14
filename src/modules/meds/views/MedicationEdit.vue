<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { diffDays } from '@/core/dates'
import { PersonSelect, TripContextHeader, VisibilitySelect, tripRepository, type Trip } from '@/modules/trip/public'
import { medicationRepository } from '../repository'
import { DEFAULT_RESERVE_DAYS, emptyMedicationDraft, normalizeTimes, stockStatus, unitsNeeded, validateMedication } from '../logic'
import { KIND, type MedicationDraft } from '../types'

const props = defineProps<{ tripId: string; id?: string }>()
const router = useRouter()

const draft = reactive<MedicationDraft>(emptyMedicationDraft())
const trip = ref<Trip>()
const submitted = ref(false)
const listPath = computed(() => `/trip/${props.tripId}/apotheke`)

onMounted(async () => {
  trip.value = await tripRepository.get(props.tripId)
  if (!trip.value) return router.replace('/trip')
  if (!props.id) return
  const item = await medicationRepository.get(props.id)
  if (!item) return router.replace(listPath.value)
  const { id: _i, tripId: _t, createdAt: _c, updatedAt: _u, ...rest } = item
  Object.assign(draft, { ...rest, times: [...rest.times] })
})

const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : null)
const cleaned = computed<MedicationDraft>(() => ({
  ...draft,
  unitsPerDose: num(draft.unitsPerDose),
  stockUnits: num(draft.stockUnits),
  times: draft.kind === 'dauer' ? draft.times.filter(Boolean) : []
}))
const errors = computed(() => validateMedication(cleaned.value))
const days = computed(() => (trip.value ? diffDays(trip.value.startDate, trip.value.endDate) + 1 : 1))
const need = computed(() => unitsNeeded(cleaned.value, days.value))
const stock = computed(() => stockStatus(cleaned.value, days.value))

function addTime() {
  draft.times.push('20:00')
}
function removeTime(i: number) {
  draft.times.splice(i, 1)
}

async function save() {
  submitted.value = true
  if (Object.keys(errors.value).length) return
  const plain: MedicationDraft = {
    ...cleaned.value,
    name: draft.name.trim(),
    person: draft.person.trim(),
    sharedWith: [...(draft.sharedWith ?? [])],
    times: normalizeTimes(cleaned.value.times)
  }
  if (props.id) await medicationRepository.update(props.id, plain)
  else await medicationRepository.create(props.tripId, plain)
  router.push(listPath.value)
}

async function remove() {
  if (!props.id || !confirm(`„${draft.name}“ löschen?`)) return
  await medicationRepository.remove(props.id)
  router.replace(listPath.value)
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="id ? 'Medikament bearbeiten' : 'Neues Medikament'" />

  <form class="row g-3" novalidate @submit.prevent="save">
    <div class="col-12 col-md-8">
      <label for="name" class="form-label">Name</label>
      <input id="name" v-model="draft.name" class="form-control" :class="{ 'is-invalid': submitted && errors.name }" />
      <div class="invalid-feedback">{{ errors.name }}</div>
    </div>
    <div class="col-12 col-md-4">
      <label for="person" class="form-label">Für wen?</label>
      <PersonSelect v-model="draft.person" :trip-id="tripId" input-id="person" privacy />
    </div>
    <div class="col-12">
      <VisibilitySelect v-model="draft.sharedWith" :trip-id="tripId" :person="draft.person" />
    </div>

    <div class="col-12">
      <label class="form-label d-block">Art</label>
      <div class="btn-group flex-wrap" role="group" aria-label="Art">
        <template v-for="(k, key) in KIND" :key="key">
          <input :id="`kind-${key}`" v-model="draft.kind" type="radio" class="btn-check" :value="key" />
          <label class="btn btn-outline-primary" :for="`kind-${key}`" :title="k.hint">
            <i :class="`bi bi-${k.icon} me-1`" aria-hidden="true"></i>{{ k.label }}
          </label>
        </template>
      </div>
    </div>

    <template v-if="draft.kind === 'dauer'">
      <div class="col-12 col-md-6">
        <label for="dose" class="form-label">Dosis (wie verordnet)</label>
        <input id="dose" v-model="draft.dose" class="form-control" placeholder="z. B. 1 Tablette" />
      </div>
      <div class="col-6 col-md-3">
        <label for="units" class="form-label">Stück pro Einnahme</label>
        <input id="units" v-model.number="draft.unitsPerDose" type="number" min="0.25" step="0.25" class="form-control"
               :class="{ 'is-invalid': submitted && errors.unitsPerDose }" />
        <div class="invalid-feedback">{{ errors.unitsPerDose }}</div>
      </div>
      <div class="col-6 col-md-3">
        <label for="stock" class="form-label">Vorrat (Stück)</label>
        <input id="stock" v-model.number="draft.stockUnits" type="number" min="0" step="1" class="form-control"
               :class="{ 'is-invalid': submitted && errors.stockUnits }" placeholder="optional" />
        <div class="invalid-feedback">{{ errors.stockUnits }}</div>
      </div>

      <div class="col-12">
        <label class="form-label d-block">Einnahmezeiten</label>
        <div class="d-flex flex-wrap gap-2 align-items-center">
          <div v-for="(t, i) in draft.times" :key="i" class="input-group w-auto">
            <input v-model="draft.times[i]" type="time" class="form-control" :aria-label="`Einnahmezeit ${i + 1}`" />
            <button type="button" class="btn btn-outline-secondary" aria-label="Zeit entfernen" @click="removeTime(i)">
              <i class="bi bi-x" aria-hidden="true"></i>
            </button>
          </div>
          <button type="button" class="btn btn-sm btn-outline-primary" @click="addTime">
            <i class="bi bi-plus" aria-hidden="true"></i> Zeit
          </button>
        </div>
        <div v-if="submitted && errors.times" class="text-danger small mt-1">{{ errors.times }}</div>
      </div>

      <div v-if="need !== null" class="col-12">
        <div class="alert py-2 mb-0" :class="stock.state === 'knapp' ? 'alert-danger' : stock.state === 'ok' ? 'alert-success' : 'alert-light border'">
          Für {{ days }} Reisetage + {{ DEFAULT_RESERVE_DAYS }} Tage Reserve: <strong>{{ need }} Stück</strong>.
          <template v-if="stock.state === 'knapp'"> Es fehlen {{ stock.missing }} – rechtzeitig Rezept besorgen.</template>
          <template v-else-if="stock.state === 'ok'"> Vorrat reicht.</template>
        </div>
      </div>
    </template>

    <div class="col-12 col-md-6">
      <label for="exp" class="form-label">Haltbar bis</label>
      <input id="exp" v-model="draft.expiryDate" type="date" class="form-control" />
    </div>
    <div class="col-12 d-flex flex-wrap gap-4">
      <div class="form-check form-switch">
        <input id="rx" v-model="draft.prescription" class="form-check-input" type="checkbox" role="switch" />
        <label class="form-check-label" for="rx">Rezeptpflichtig</label>
      </div>
      <div class="form-check form-switch">
        <input id="hand" v-model="draft.handLuggage" class="form-check-input" type="checkbox" role="switch" />
        <label class="form-check-label" for="hand">Ins Handgepäck</label>
      </div>
      <div class="form-check form-switch">
        <input id="cool" v-model="draft.cooling" class="form-check-input" type="checkbox" role="switch" />
        <label class="form-check-label" for="cool">Kühlen</label>
      </div>
      <div class="form-check form-switch">
        <input id="packed" v-model="draft.packed" class="form-check-input" type="checkbox" role="switch" />
        <label class="form-check-label" for="packed">Eingepackt</label>
      </div>
    </div>
    <div class="col-12">
      <label for="notes" class="form-label">Notizen</label>
      <textarea id="notes" v-model="draft.notes" rows="2" class="form-control"
                placeholder="z. B. Wirkstoff, Arzt-Bescheinigung für den Zoll, Hinweise"></textarea>
    </div>

    <div class="col-12 d-flex gap-2">
      <button type="submit" class="btn btn-primary"><i class="bi bi-check-lg me-1" aria-hidden="true"></i>Speichern</button>
      <RouterLink :to="listPath" class="btn btn-outline-secondary">Abbrechen</RouterLink>
      <button v-if="id" type="button" class="btn btn-outline-danger ms-auto" @click="remove">
        <i class="bi bi-trash me-1" aria-hidden="true"></i>Löschen
      </button>
    </div>
  </form>
</template>
