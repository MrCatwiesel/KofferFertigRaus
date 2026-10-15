<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatMoney } from '@/core/format'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import { travelRepository } from '../repository'
import {
  durationMinutes, emptyLegDraft, formatDuration, fuelCost, legCost, legsOf, modeFromTripTransport,
  recommendedBreaks, validateLeg
} from '../logic'
import { DIRECTION, MODE, type TravelDirection, type TravelLegDraft } from '../types'

const props = defineProps<{ tripId: string; id?: string }>()
const router = useRouter()
const route = useRoute()

const draft = reactive<TravelLegDraft>(emptyLegDraft())
const trip = ref<Trip>()
const submitted = ref(false)
const saving = ref(false)
const listPath = computed(() => `/trip/${props.tripId}/anreise`)

onMounted(async () => {
  trip.value = await tripRepository.get(props.tripId)
  if (!trip.value) return router.replace('/trip')
  if (props.id) {
    const item = await travelRepository.get(props.id)
    if (!item) return router.replace(listPath.value)
    const { id: _i, tripId: _t, position: _p, createdAt: _c, updatedAt: _u, ...rest } = item
    Object.assign(draft, rest)
    return
  }
  // Neue Etappe: sinnvolle Vorbelegung
  const direction: TravelDirection = route.query.richtung === 'rueck' ? 'rueck' : 'hin'
  const existing = legsOf(await travelRepository.listByTrip(props.tripId), direction)
  const last = existing.at(-1)
  Object.assign(
    draft,
    emptyLegDraft({
      direction,
      mode: last?.mode ?? modeFromTripTransport(trip.value.transport),
      from: last?.to ?? (direction === 'rueck' ? trip.value.destination : ''),
      to: direction === 'hin' && !last ? trip.value.destination : '',
      date: last?.date ?? (direction === 'hin' ? trip.value.startDate : trip.value.endDate),
      currency: trip.value.currency,
      consumption: last?.consumption ?? null,
      fuelPrice: last?.fuelPrice ?? null
    })
  )
})

/** Leere Zahlenfelder liefern "" – in null umwandeln. */
const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : null)
const NUM_FIELDS = ['distanceKm', 'cost', 'consumption', 'fuelPrice', 'tolls'] as const
const cleaned = computed<TravelLegDraft>(() => {
  const c = { ...draft }
  for (const k of NUM_FIELDS) c[k] = num(draft[k])
  return c
})

const errors = computed(() => validateLeg(cleaned.value))
const duration = computed(() => durationMinutes(draft.departTime, draft.arriveTime))
const overnight = computed(() => duration.value !== null && draft.arriveTime < draft.departTime)
const fuel = computed(() => fuelCost(cleaned.value))
const computedCost = computed(() => (cleaned.value.cost === null ? legCost(cleaned.value) : null))
const breaks = computed(() => recommendedBreaks(draft.mode, duration.value))

function invalid(f: keyof TravelLegDraft) {
  return submitted.value && !!errors.value[f]
}

function swap() {
  ;[draft.from, draft.to] = [draft.to, draft.from]
}

async function save() {
  submitted.value = true
  if (Object.keys(errors.value).length) return
  saving.value = true
  try {
    const plain: TravelLegDraft = { ...cleaned.value, from: draft.from.trim(), to: draft.to.trim(), url: draft.url.trim() }
    if (props.id) await travelRepository.update(props.id, plain)
    else await travelRepository.create(props.tripId, plain)
    router.push(listPath.value)
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!props.id || !confirm('Diese Etappe löschen?')) return
  await travelRepository.remove(props.id)
  router.replace(listPath.value)
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="id ? 'Etappe bearbeiten' : 'Neue Etappe'" />

  <form class="row g-3" novalidate @submit.prevent="save">
    <div class="col-12">
      <div class="btn-group" role="group" :aria-label="t('Richtung')">
        <template v-for="(label, key) in DIRECTION" :key="key">
          <input :id="`dir-${key}`" v-model="draft.direction" type="radio" class="btn-check" :value="key" />
          <label class="btn btn-outline-primary" :for="`dir-${key}`">{{ label }}</label>
        </template>
      </div>
    </div>

    <div class="col-12">
      <label class="form-label d-block">{{ t('Verkehrsmittel') }}</label>
      <div class="d-flex flex-wrap gap-2">
        <template v-for="(m, key) in MODE" :key="key">
          <input :id="`mode-${key}`" v-model="draft.mode" type="radio" class="btn-check" :value="key" />
          <label class="btn btn-outline-secondary btn-sm" :for="`mode-${key}`">
            <i :class="`bi bi-${m.icon} me-1`" aria-hidden="true"></i>{{ m.label }}
          </label>
        </template>
      </div>
    </div>

    <div class="col-12 col-md">
      <label for="from" class="form-label">{{ t('Von') }}</label>
      <input id="from" v-model="draft.from" class="form-control" :class="{ 'is-invalid': invalid('from') }"
             :placeholder="t('Ort, Bahnhof, Flughafen')" autocomplete="off" />
      <div class="invalid-feedback">{{ errors.from }}</div>
    </div>
    <div class="col-12 col-md-auto d-flex align-items-end justify-content-center">
      <button type="button" class="btn btn-outline-secondary" :aria-label="t('Start und Ziel tauschen')" @click="swap">
        <i class="bi bi-arrow-left-right" aria-hidden="true"></i>
      </button>
    </div>
    <div class="col-12 col-md">
      <label for="to" class="form-label">{{ t('Nach') }}</label>
      <input id="to" v-model="draft.to" class="form-control" :class="{ 'is-invalid': invalid('to') }" autocomplete="off" />
      <div class="invalid-feedback">{{ errors.to }}</div>
    </div>

    <div class="col-12 col-md-4">
      <label for="date" class="form-label">{{ t('Datum') }}</label>
      <input id="date" v-model="draft.date" type="date" class="form-control" />
    </div>
    <div class="col-6 col-md-4">
      <label for="dep" class="form-label">{{ t('Abfahrt') }}</label>
      <input id="dep" v-model="draft.departTime" type="time" class="form-control" :class="{ 'is-invalid': invalid('departTime') }" />
      <div class="invalid-feedback">{{ errors.departTime }}</div>
    </div>
    <div class="col-6 col-md-4">
      <label for="arr" class="form-label">{{ t('Ankunft') }}</label>
      <input id="arr" v-model="draft.arriveTime" type="time" class="form-control" :class="{ 'is-invalid': invalid('arriveTime') }" />
      <div class="invalid-feedback">{{ errors.arriveTime }}</div>
    </div>
    <div v-if="duration !== null" class="col-12 small text-body-secondary">
      <i class="bi bi-clock me-1" aria-hidden="true"></i>{{ t('{formatDuration} unterwegs', { formatDuration: formatDuration(duration) }) }}
      <template v-if="overnight"> {{ t('(Ankunft am Folgetag)') }}</template>
      <template v-if="breaks > 0"> {{ t('· {breaks} {x} einplanen', { breaks, x: breaks === 1 ? 'Pause' : 'Pausen' }) }}</template>
    </div>

    <div class="col-12 col-md-4">
      <label for="km" class="form-label">{{ t('Entfernung (km)') }}</label>
      <input id="km" v-model.number="draft.distanceKm" type="number" min="0" step="1" class="form-control"
             :class="{ 'is-invalid': invalid('distanceKm') }" :placeholder="t('optional')" />
      <div class="invalid-feedback">{{ errors.distanceKm }}</div>
    </div>

    <!-- Kostenrechner nur fürs Auto -->
    <template v-if="draft.mode === 'auto'">
      <div class="col-6 col-md-4">
        <label for="cons" class="form-label">{{ t('Verbrauch (l/100 km)') }}</label>
        <input id="cons" v-model.number="draft.consumption" type="number" min="0" step="0.1" class="form-control"
               :class="{ 'is-invalid': invalid('consumption') }" placeholder="z. B. 6,5" />
        <div class="invalid-feedback">{{ errors.consumption }}</div>
      </div>
      <div class="col-6 col-md-4">
        <label for="fuel" class="form-label">{{ t('Preis pro Liter') }}</label>
        <input id="fuel" v-model.number="draft.fuelPrice" type="number" min="0" step="0.01" class="form-control"
               :class="{ 'is-invalid': invalid('fuelPrice') }" placeholder="z. B. 1,75" />
        <div class="invalid-feedback">{{ errors.fuelPrice }}</div>
      </div>
      <div class="col-12 col-md-4">
        <label for="tolls" class="form-label">{{ t('Maut / Vignette') }}</label>
        <input id="tolls" v-model.number="draft.tolls" type="number" min="0" step="0.5" class="form-control"
               :class="{ 'is-invalid': invalid('tolls') }" :placeholder="t('optional')" />
        <div class="invalid-feedback">{{ errors.tolls }}</div>
      </div>
      <div v-if="fuel !== null" class="col-12 col-md-8 d-flex align-items-end small text-body-secondary">
        <span><i class="bi bi-fuel-pump me-1" aria-hidden="true"></i>{{ t('Sprit ca. {fuel}', { fuel: formatMoney(fuel, draft.currency) }) }}</span>
      </div>
    </template>

    <div class="col-12 col-md-6">
      <label for="cost" class="form-label">{{ draft.mode === 'auto' ? 'Kosten (überschreibt Berechnung)' : 'Ticketpreis' }}</label>
      <div class="input-group has-validation">
        <input id="cost" v-model.number="draft.cost" type="number" min="0" step="0.5" class="form-control"
               :class="{ 'is-invalid': invalid('cost') }"
               :placeholder="computedCost !== null ? `berechnet: ${formatMoney(computedCost, draft.currency)}` : 'optional'" />
        <select v-model="draft.currency" class="form-select flex-grow-0 w-auto" :aria-label="t('Währung')">
          <option>{{ t('EUR') }}</option><option>{{ t('CHF') }}</option><option>{{ t('USD') }}</option><option>{{ t('GBP') }}</option>
        </select>
        <div class="invalid-feedback">{{ errors.cost }}</div>
      </div>
    </div>
    <div class="col-12 col-md-6">
      <label for="ref" class="form-label">{{ t('Buchungsnummer') }}</label>
      <input id="ref" v-model="draft.bookingRef" class="form-control" :placeholder="t('Ticket, Flugnummer …')" />
    </div>
    <div class="col-12">
      <label for="url" class="form-label">{{ t('Link') }}</label>
      <input id="url" v-model="draft.url" type="url" class="form-control" :placeholder="t('https://…')" />
    </div>
    <div class="col-12">
      <label for="notes" class="form-label">{{ t('Notizen') }}</label>
      <textarea id="notes" v-model="draft.notes" rows="2" class="form-control"
                :placeholder="t('Gleis, Sitzplatz, Raststätte, Gepäck …')"></textarea>
    </div>

    <div class="col-12 d-flex gap-2">
      <button type="submit" class="btn btn-primary" :disabled="saving">
        <i class="bi bi-check-lg me-1" aria-hidden="true"></i>{{ t('Speichern') }}
      </button>
      <RouterLink :to="listPath" class="btn btn-outline-secondary">{{ t('Abbrechen') }}</RouterLink>
      <button v-if="id" type="button" class="btn btn-outline-danger ms-auto" @click="remove">
        <i class="bi bi-trash me-1" aria-hidden="true"></i>{{ t('Löschen') }}
      </button>
    </div>
  </form>
</template>
