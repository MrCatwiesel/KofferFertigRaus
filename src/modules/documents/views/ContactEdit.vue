<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { TripContextHeader } from '@/modules/trip/public'
import { contactRepository } from '../repository'
import { emptyContactDraft, validateContact } from '../logic'
import type { EmergencyContactDraft } from '../types'

const props = defineProps<{ tripId: string; id?: string }>()
const router = useRouter()

const draft = reactive<EmergencyContactDraft>(emptyContactDraft())
const submitted = ref(false)
const source = ref('')
const listPath = computed(() => `/trip/${props.tripId}/dokumente`)

onMounted(async () => {
  if (!props.id) return
  const item = await contactRepository.get(props.id)
  if (!item) return router.replace(listPath.value)
  const { id: _i, tripId: _t, createdAt: _c, updatedAt: _u, source: src, ...rest } = item
  source.value = src ?? ''
  Object.assign(draft, rest)
})

const errors = computed(() => validateContact(draft))

async function save() {
  submitted.value = true
  if (Object.keys(errors.value).length) return
  const plain = { label: draft.label.trim(), phone: draft.phone.trim(), notes: draft.notes.trim() }
  if (props.id) await contactRepository.update(props.id, plain)
  else await contactRepository.create(props.tripId, plain)
  router.push(listPath.value)
}

async function remove() {
  if (!props.id || !confirm(`„${draft.label}“ löschen?`)) return
  await contactRepository.remove(props.id)
  router.replace(listPath.value)
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="id ? $t('Nummer bearbeiten') : $t('Neue Notfallnummer')" />

  <div v-if="source" class="alert alert-info small py-2">
    <i class="bi bi-info-circle me-1" aria-hidden="true"></i>{{ $t('Automatisch aus den Reisehinweisen des Auswärtigen Amts. Ändert sich dort etwas, wird diese Nummer beim nächsten Aktualisieren angepasst; nimmst du das Land aus der Reise, verschwindet sie.') }}
  </div>

  <form class="row g-3" novalidate @submit.prevent="save">
    <div class="col-12">
      <label for="label" class="form-label">{{ $t('Wer?') }}</label>
      <input id="label" v-model="draft.label" class="form-control" :class="{ 'is-invalid': submitted && errors.label }"
             :placeholder="$t('z. B. Notruf Auslandskrankenversicherung')" />
      <div class="invalid-feedback">{{ errors.label }}</div>
    </div>
    <div class="col-12">
      <label for="phone" class="form-label">{{ $t('Telefon') }}</label>
      <input id="phone" v-model="draft.phone" type="tel" class="form-control" :class="{ 'is-invalid': submitted && errors.phone }"
             placeholder="+49 …" />
      <div class="invalid-feedback">{{ errors.phone }}</div>
      <div class="form-text">{{ $t('Mit Ländervorwahl, damit es auch im Ausland funktioniert.') }}</div>
    </div>
    <div class="col-12">
      <label for="notes" class="form-label">{{ $t('Notiz') }}</label>
      <input id="notes" v-model="draft.notes" class="form-control" :placeholder="$t('z. B. Versicherungsnummer bereithalten')" />
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
