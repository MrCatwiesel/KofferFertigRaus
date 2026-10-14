<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { PersonSelect, TripContextHeader } from '@/modules/trip/public'
import { packingRepository } from '../repository'
import { emptyPackingDraft, validatePacking } from '../logic'
import { CATEGORY, type PackingDraft } from '../types'

const props = defineProps<{ tripId: string; id: string }>()
const router = useRouter()

const draft = reactive<PackingDraft>(emptyPackingDraft())
const submitted = ref(false)
const listPath = computed(() => `/trip/${props.tripId}/packliste`)

onMounted(async () => {
  const item = await packingRepository.get(props.id)
  if (!item) return router.replace(listPath.value)
  const { id: _i, tripId: _t, createdAt: _c, updatedAt: _u, ...rest } = item
  Object.assign(draft, rest)
})

const errors = computed(() => validatePacking({ ...draft, quantity: Number(draft.quantity) }))

async function save() {
  submitted.value = true
  if (Object.keys(errors.value).length) return
  await packingRepository.update(props.id, { ...draft, name: draft.name.trim(), person: draft.person.trim(), quantity: Number(draft.quantity) })
  router.push(listPath.value)
}

async function remove() {
  if (!confirm(`„${draft.name}“ von der Liste nehmen?`)) return
  await packingRepository.remove(props.id)
  router.replace(listPath.value)
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" title="Eintrag bearbeiten" />

  <form class="row g-3" novalidate @submit.prevent="save">
    <div class="col-12 col-md-8">
      <label for="name" class="form-label">Was?</label>
      <input id="name" v-model="draft.name" class="form-control" :class="{ 'is-invalid': submitted && errors.name }" />
      <div class="invalid-feedback">{{ errors.name }}</div>
    </div>
    <div class="col-12 col-md-4">
      <label for="qty" class="form-label">Menge</label>
      <input id="qty" v-model.number="draft.quantity" type="number" min="1" step="1" class="form-control"
             :class="{ 'is-invalid': submitted && errors.quantity }" />
      <div class="invalid-feedback">{{ errors.quantity }}</div>
    </div>
    <div class="col-12 col-md-6">
      <label for="cat" class="form-label">Kategorie</label>
      <select id="cat" v-model="draft.category" class="form-select">
        <option v-for="(c, key) in CATEGORY" :key="key" :value="key">{{ c.label }}</option>
      </select>
    </div>
    <div class="col-12 col-md-6">
      <label for="person" class="form-label">Für wen?</label>
      <PersonSelect v-model="draft.person" :trip-id="tripId" input-id="person" privacy />
    </div>
    <div class="col-12 d-flex flex-wrap gap-4">
      <div class="form-check form-switch">
        <input id="essential" v-model="draft.essential" class="form-check-input" type="checkbox" role="switch" />
        <label class="form-check-label" for="essential">Wichtig – darf nicht fehlen</label>
      </div>
      <div class="form-check form-switch">
        <input id="packed" v-model="draft.packed" class="form-check-input" type="checkbox" role="switch" />
        <label class="form-check-label" for="packed">Eingepackt</label>
      </div>
    </div>
    <div class="col-12">
      <label for="notes" class="form-label">Notiz</label>
      <input id="notes" v-model="draft.notes" class="form-control" placeholder="z. B. im Handgepäck" />
    </div>
    <div class="col-12 d-flex gap-2">
      <button type="submit" class="btn btn-primary"><i class="bi bi-check-lg me-1" aria-hidden="true"></i>Speichern</button>
      <RouterLink :to="listPath" class="btn btn-outline-secondary">Abbrechen</RouterLink>
      <button type="button" class="btn btn-outline-danger ms-auto" @click="remove">
        <i class="bi bi-trash me-1" aria-hidden="true"></i>Löschen
      </button>
    </div>
  </form>
</template>
