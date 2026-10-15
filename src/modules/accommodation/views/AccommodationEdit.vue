<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { formatMoney } from '@/core/format'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import { accommodationRepository } from '../repository'
import { emptyAccommodationDraft, nights, outsideTripWarning, pricePerNight, validateAccommodation } from '../logic'
import { ACCOMMODATION_STATUS, ACCOMMODATION_TYPE_LABELS, type AccommodationDraft } from '../types'

const props = defineProps<{ tripId: string; id?: string }>()
const router = useRouter()

const draft = reactive<AccommodationDraft>(emptyAccommodationDraft())
const trip = ref<Trip>()
const submitted = ref(false)
const saving = ref(false)
const listPath = computed(() => `/trip/${props.tripId}/unterkuenfte`)

onMounted(async () => {
  trip.value = await tripRepository.get(props.tripId)
  if (!trip.value) return router.replace('/trip')
  if (props.id) {
    const item = await accommodationRepository.get(props.id)
    if (!item) return router.replace(listPath.value)
    const { id: _i, tripId: _t, createdAt: _c, updatedAt: _u, ...rest } = item
    Object.assign(draft, rest)
  } else {
    Object.assign(draft, emptyAccommodationDraft(trip.value.startDate, trip.value.endDate, trip.value.currency))
  }
})

const errors = computed(() => validateAccommodation(draft))
const warning = computed(() => (trip.value ? outsideTripWarning(draft, trip.value.startDate, trip.value.endDate) : null))
const info = computed(() => {
  if (!draft.checkIn || !draft.checkOut || errors.value.checkOut) return null
  const n = nights(draft.checkIn, draft.checkOut)
  const price = typeof draft.price === 'number' ? draft.price : null
  const ppn = pricePerNight({ price, checkIn: draft.checkIn, checkOut: draft.checkOut })
  return `${n} ${n === 1 ? 'Nacht' : 'Nächte'}` + (ppn !== null ? ` · ${formatMoney(ppn, draft.currency)} pro Nacht` : '')
})

function invalid(f: keyof AccommodationDraft) {
  return submitted.value && !!errors.value[f]
}

async function save() {
  submitted.value = true
  if (Object.keys(errors.value).length) return
  saving.value = true
  try {
    const price = typeof draft.price === 'number' && !Number.isNaN(draft.price) ? draft.price : null
    const plain: AccommodationDraft = { ...draft, price, name: draft.name.trim(), url: draft.url.trim() }
    if (props.id) await accommodationRepository.update(props.id, plain)
    else await accommodationRepository.create(props.tripId, plain)
    router.push(listPath.value)
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!props.id || !confirm(`„${draft.name}“ löschen?`)) return
  await accommodationRepository.remove(props.id)
  router.replace(listPath.value)
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="id ? 'Unterkunft bearbeiten' : 'Neue Unterkunft'" />

  <form class="row g-3" novalidate @submit.prevent="save">
    <div class="col-12 col-md-8">
      <label for="name" class="form-label">{{ t('Name') }}</label>
      <input id="name" v-model="draft.name" class="form-control" :class="{ 'is-invalid': invalid('name') }"
             :placeholder="t('z. B. Hotel Seeblick')" />
      <div class="invalid-feedback">{{ errors.name }}</div>
    </div>
    <div class="col-12 col-md-4">
      <label for="type" class="form-label">{{ t('Art') }}</label>
      <select id="type" v-model="draft.type" class="form-select">
        <option v-for="(label, key) in ACCOMMODATION_TYPE_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>
    </div>

    <div class="col-6">
      <label for="in" class="form-label">{{ t('Anreise') }}</label>
      <input id="in" v-model="draft.checkIn" type="date" class="form-control" :class="{ 'is-invalid': invalid('checkIn') }" />
      <div class="invalid-feedback">{{ errors.checkIn }}</div>
    </div>
    <div class="col-6">
      <label for="out" class="form-label">{{ t('Abreise') }}</label>
      <input id="out" v-model="draft.checkOut" type="date" class="form-control" :min="draft.checkIn"
             :class="{ 'is-invalid': invalid('checkOut') }" />
      <div class="invalid-feedback">{{ errors.checkOut }}</div>
    </div>
    <div v-if="info || warning" class="col-12 small">
      <span v-if="info" class="text-body-secondary"><i class="bi bi-moon-stars me-1" aria-hidden="true"></i>{{ info }}</span>
      <span v-if="warning" class="text-warning-emphasis ms-2"><i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>{{ warning }}</span>
    </div>

    <div class="col-12">
      <label class="form-label d-block">{{ t('Status') }}</label>
      <div class="btn-group flex-wrap" role="group" :aria-label="t('Status')">
        <template v-for="(s, key) in ACCOMMODATION_STATUS" :key="key">
          <input :id="`st-${key}`" v-model="draft.status" type="radio" class="btn-check" :value="key" />
          <label class="btn btn-outline-primary" :for="`st-${key}`">{{ s.label }}</label>
        </template>
      </div>
    </div>

    <div class="col-12 col-md-6">
      <label for="price" class="form-label">{{ t('Preis gesamt') }}</label>
      <div class="input-group has-validation">
        <input id="price" v-model.number="draft.price" type="number" min="0" step="1" class="form-control"
               :class="{ 'is-invalid': invalid('price') }" :placeholder="t('optional')" />
        <select v-model="draft.currency" class="form-select flex-grow-0 w-auto" :aria-label="t('Währung')">
          <option>{{ t('EUR') }}</option><option>{{ t('CHF') }}</option><option>{{ t('USD') }}</option><option>{{ t('GBP') }}</option>
        </select>
        <div class="invalid-feedback">{{ errors.price }}</div>
      </div>
    </div>
    <div class="col-12 col-md-6">
      <label for="cancel" class="form-label">{{ t('Kostenlos stornierbar bis') }}</label>
      <input id="cancel" v-model="draft.cancelUntil" type="date" class="form-control"
             :class="{ 'is-invalid': invalid('cancelUntil') }" />
      <div class="invalid-feedback">{{ errors.cancelUntil }}</div>
    </div>

    <div class="col-12">
      <label for="address" class="form-label">{{ t('Adresse') }}</label>
      <input id="address" v-model="draft.address" class="form-control" autocomplete="off" />
    </div>
    <div class="col-12 col-md-8">
      <label for="url" class="form-label">{{ t('Link') }}</label>
      <input id="url" v-model="draft.url" type="url" class="form-control" :placeholder="t('https://…')" />
    </div>
    <div class="col-12 col-md-4">
      <label for="ref" class="form-label">{{ t('Buchungsnummer') }}</label>
      <input id="ref" v-model="draft.bookingRef" class="form-control" />
    </div>
    <div class="col-12">
      <label for="notes" class="form-label">{{ t('Notizen') }}</label>
      <textarea id="notes" v-model="draft.notes" rows="3" class="form-control"
                :placeholder="t('Frühstück, Parkplatz, Check-in-Zeit …')"></textarea>
    </div>

    <div class="col-12 d-flex gap-2">
      <button type="submit" class="btn btn-primary" :disabled="saving">
        <i class="bi bi-check-lg me-1" aria-hidden="true"></i>{{ t('Speichern') }}
      </button>
      <RouterLink :to="`/trip/${tripId}/unterkuenfte`" class="btn btn-outline-secondary">{{ t('Abbrechen') }}</RouterLink>
      <button v-if="id" type="button" class="btn btn-outline-danger ms-auto" @click="remove">
        <i class="bi bi-trash me-1" aria-hidden="true"></i>{{ t('Löschen') }}
      </button>
    </div>
  </form>
</template>
