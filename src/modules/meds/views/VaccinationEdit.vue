<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { PersonSelect, TripContextHeader } from '@/modules/trip/public'
import { vaccinationRepository } from '../repository'
import { emptyVaccinationDraft, validateVaccination } from '../logic'
import { VACC_STATUS, type VaccinationDraft } from '../types'

const props = defineProps<{ tripId: string; id?: string }>()
const router = useRouter()

const draft = reactive<VaccinationDraft>(emptyVaccinationDraft())
const submitted = ref(false)
const listPath = computed(() => `/trip/${props.tripId}/apotheke`)

onMounted(async () => {
  if (!props.id) return
  const item = await vaccinationRepository.get(props.id)
  if (!item) return router.replace(listPath.value)
  const { id: _i, tripId: _t, createdAt: _c, updatedAt: _u, ...rest } = item
  Object.assign(draft, rest)
})

const errors = computed(() => validateVaccination(draft))

async function save() {
  submitted.value = true
  if (Object.keys(errors.value).length) return
  const plain = { ...draft, name: draft.name.trim(), person: draft.person.trim() }
  if (props.id) await vaccinationRepository.update(props.id, plain)
  else await vaccinationRepository.create(props.tripId, plain)
  router.push(listPath.value)
}

async function remove() {
  if (!props.id || !confirm(`„${draft.name}“ löschen?`)) return
  await vaccinationRepository.remove(props.id)
  router.replace(listPath.value)
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="id ? 'Impfung bearbeiten' : 'Neue Impfung'" />

  <form class="row g-3" novalidate @submit.prevent="save">
    <div class="col-12 col-md-8">
      <label for="name" class="form-label">Impfung</label>
      <input id="name" v-model="draft.name" class="form-control" :class="{ 'is-invalid': submitted && errors.name }"
             placeholder="z. B. Tetanus, Hepatitis A" />
      <div class="invalid-feedback">{{ errors.name }}</div>
    </div>
    <div class="col-12 col-md-4">
      <label for="person" class="form-label">Für wen?</label>
      <PersonSelect v-model="draft.person" :trip-id="tripId" input-id="person" privacy />
    </div>
    <div class="col-12">
      <label class="form-label d-block">Status</label>
      <div class="btn-group flex-wrap" role="group" aria-label="Status">
        <template v-for="(s, key) in VACC_STATUS" :key="key">
          <input :id="`vs-${key}`" v-model="draft.status" type="radio" class="btn-check" :value="key" />
          <label class="btn btn-outline-primary" :for="`vs-${key}`">{{ s.label }}</label>
        </template>
      </div>
    </div>
    <div class="col-6">
      <label for="date" class="form-label">{{ draft.status === 'erledigt' ? 'Geimpft am' : 'Termin' }}</label>
      <input id="date" v-model="draft.date" type="date" class="form-control" />
    </div>
    <div class="col-6">
      <label for="valid" class="form-label">Schutz gültig bis</label>
      <input id="valid" v-model="draft.validUntil" type="date" class="form-control" />
    </div>
    <div class="col-12">
      <label for="notes" class="form-label">Notizen</label>
      <textarea id="notes" v-model="draft.notes" rows="2" class="form-control" placeholder="Arzt, Impfpass, Folgetermin …"></textarea>
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
