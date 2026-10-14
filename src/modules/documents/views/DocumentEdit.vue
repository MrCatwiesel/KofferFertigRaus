<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { PersonSelect, TripContextHeader, VisibilitySelect, tripRepository, type Trip } from '@/modules/trip/public'
import { documentRepository } from '../repository'
import { VALIDITY_TEXT, emptyDocumentDraft, validateDocument, validity } from '../logic'
import { DOC_STATUS, DOC_TYPE, type TravelDocumentDraft } from '../types'

const props = defineProps<{ tripId: string; id?: string }>()
const router = useRouter()

const draft = reactive<TravelDocumentDraft>(emptyDocumentDraft())
const trip = ref<Trip>()
const submitted = ref(false)
const titleTouched = ref(false)
const listPath = computed(() => `/trip/${props.tripId}/dokumente`)

onMounted(async () => {
  trip.value = await tripRepository.get(props.tripId)
  if (!trip.value) return router.replace('/trip')
  if (!props.id) {
    draft.title = DOC_TYPE[draft.type].label
    return
  }
  const item = await documentRepository.get(props.id)
  if (!item) return router.replace(listPath.value)
  const { id: _i, tripId: _t, createdAt: _c, updatedAt: _u, ...rest } = item
  Object.assign(draft, rest)
  titleTouched.value = true
})

/** Bezeichnung folgt der Art, bis man sie selbst ändert. */
function onTypeChange() {
  if (!titleTouched.value) draft.title = DOC_TYPE[draft.type].label
}

const errors = computed(() => validateDocument(draft))
const warn = computed(() => {
  if (!trip.value) return null
  const v = validity(draft, trip.value.endDate)
  return v === 'ok' || v === 'unbekannt' ? null : VALIDITY_TEXT[v]
})

async function save() {
  submitted.value = true
  if (Object.keys(errors.value).length) return
  const plain = { ...draft, sharedWith: [...(draft.sharedWith ?? [])], title: draft.title.trim(), person: draft.person.trim(), number: draft.number.trim() }
  if (plain.status !== 'vorhanden') plain.packed = false
  if (props.id) await documentRepository.update(props.id, plain)
  else await documentRepository.create(props.tripId, plain)
  router.push(listPath.value)
}

async function remove() {
  if (!props.id || !confirm(`„${draft.title}“ löschen?`)) return
  await documentRepository.remove(props.id)
  router.replace(listPath.value)
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="id ? $t('Dokument bearbeiten') : $t('Neues Dokument')" />

  <form class="row g-3" novalidate @submit.prevent="save">
    <div class="col-12 col-md-6">
      <label for="type" class="form-label">{{ $t('Art') }}</label>
      <select id="type" v-model="draft.type" class="form-select" @change="onTypeChange">
        <option v-for="(t, key) in DOC_TYPE" :key="key" :value="key">{{ t.label }}</option>
      </select>
    </div>
    <div class="col-12 col-md-6">
      <label for="person" class="form-label">{{ $t('Für wen?') }}</label>
      <PersonSelect v-model="draft.person" :trip-id="tripId" input-id="person" privacy />
    </div>
    <div class="col-12">
      <VisibilitySelect v-model="draft.sharedWith" :trip-id="tripId" :person="draft.person" />
    </div>
    <div class="col-12">
      <label for="title" class="form-label">{{ $t('Bezeichnung') }}</label>
      <input id="title" v-model="draft.title" class="form-control" :class="{ 'is-invalid': submitted && errors.title }"
             @input="titleTouched = true" />
      <div class="invalid-feedback">{{ errors.title }}</div>
    </div>

    <div class="col-12">
      <label class="form-label d-block">{{ $t('Status') }}</label>
      <div class="btn-group" role="group" :aria-label="$t('Status')">
        <template v-for="(s, key) in DOC_STATUS" :key="key">
          <input :id="`ds-${key}`" v-model="draft.status" type="radio" class="btn-check" :value="key" />
          <label class="btn btn-outline-primary" :for="`ds-${key}`">{{ s.label }}</label>
        </template>
      </div>
    </div>

    <div class="col-12 col-md-6">
      <label for="number" class="form-label">{{ $t('Nummer') }}</label>
      <input id="number" v-model="draft.number" class="form-control" autocomplete="off" placeholder="optional" />
      <div class="form-text">{{ $t('Bleibt nur auf diesem Gerät.') }}</div>
    </div>
    <div class="col-12 col-md-6">
      <label for="valid" class="form-label">{{ $t('Gültig bis') }}</label>
      <input id="valid" v-model="draft.validUntil" type="date" class="form-control" />
      <div v-if="warn" class="small mt-1" :class="warn.cls"><i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>{{ warn.text }}</div>
    </div>

    <div class="col-12 d-flex flex-wrap gap-4">
      <div class="form-check form-switch">
        <input id="copy" v-model="draft.hasCopy" class="form-check-input" type="checkbox" role="switch" />
        <label class="form-check-label" for="copy">{{ $t('Kopie / Foto abgelegt') }}</label>
      </div>
      <div class="form-check form-switch">
        <input id="packed" v-model="draft.packed" class="form-check-input" type="checkbox" role="switch" :disabled="draft.status !== 'vorhanden'" />
        <label class="form-check-label" for="packed">{{ $t('Eingepackt') }}</label>
      </div>
    </div>
    <div class="col-12">
      <label for="notes" class="form-label">{{ $t('Notizen') }}</label>
      <textarea id="notes" v-model="draft.notes" rows="2" class="form-control"
                :placeholder="$t('z. B. Termin Bürgeramt, Hotline der Versicherung, wo die Kopie liegt')"></textarea>
    </div>

    <div class="col-12 d-flex gap-2">
      <button type="submit" class="btn btn-primary"><i class="bi bi-check-lg me-1" aria-hidden="true"></i>{{ $t('Speichern') }}</button>
      <RouterLink :to="listPath" class="btn btn-outline-secondary">{{ $t('Abbrechen') }}</RouterLink>
      <button v-if="id" type="button" class="btn btn-outline-danger ms-auto" @click="remove">
        <i class="bi bi-trash me-1" aria-hidden="true"></i>{{ $t('Löschen') }}
      </button>
    </div>
  </form>
</template>
