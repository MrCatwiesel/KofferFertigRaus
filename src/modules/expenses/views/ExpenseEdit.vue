<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { formatMoney } from '@/core/format'
import { resizeBlob } from '@/services/images'
import { TripContextHeader, participantsOf, tripRepository, type Trip } from '@/modules/trip/public'
import { expenseRepository } from '../repository'
import { defaultExpenseDate, emptyExpenseDraft, inTripCurrency, validateExpense } from '../logic'
import { CURRENCIES, EXPENSE_CATEGORY, type ExpenseDraft } from '../types'
import { currencyName, currencyOf } from '@/core/countries'
import { todayIso } from '@/core/dates'
import { getMeta, setMeta } from '@/core/meta'
import { getRate, type Rate } from '@/services/exchange'

const props = defineProps<{ tripId: string; id?: string }>()
const router = useRouter()

const draft = reactive<ExpenseDraft>(emptyExpenseDraft())
const trip = ref<Trip>()
const submitted = ref(false)
const receiptUrl = ref('')
const receiptBusy = ref(false)
const listPath = computed(() => `/trip/${props.tripId}/ausgaben`)
const tripCurrency = computed(() => trip.value?.currency ?? 'EUR')
const people = computed(() => participantsOf(trip.value))

/** Landeswährungen der Zielländer (z. B. CHF) – stehen in der Auswahl oben */
const localCurrencies = computed(() => [...new Set((trip.value?.countries ?? []).map(currencyOf).filter((c): c is string => !!c && c !== tripCurrency.value))])
const currencyOptions = computed(() => [...new Set([tripCurrency.value, ...localCurrencies.value, draft.currency, ...CURRENCIES])].filter(Boolean))
const lastCurrencyKey = computed(() => `ausgaben.waehrung.${props.tripId}`)

// Kurs: automatisch (EZB) für den Tag der Ausgabe, solange er nicht von Hand geändert wurde
const rateInfo = ref<Rate | null>(null)
const rateState = ref<'' | 'laedt' | 'fehlt'>('')
const rateTouched = ref(false)
const ready = ref(false)

async function loadRate(force = false) {
  if (draft.currency === tripCurrency.value || (rateTouched.value && !force)) return
  rateState.value = 'laedt'
  const r = await getRate(draft.currency, tripCurrency.value, draft.date || todayIso(), todayIso())
  rateInfo.value = r
  rateState.value = r ? '' : 'fehlt'
  if (r) {
    draft.rate = Math.round(r.rate * 1e6) / 1e6
    rateTouched.value = false
  }
}
watch(() => [draft.currency, draft.date], () => ready.value && void loadRate())
const rateHint = computed(() => {
  if (rateState.value === 'laedt') return 'Kurs wird abgefragt …'
  if (rateState.value === 'fehlt') return `Kein EZB-Kurs für ${draft.currency} verfügbar – bitte Kurs eintragen (z. B. vom Kontoauszug oder Wechselbeleg).`
  if (rateTouched.value || !rateInfo.value) return ''
  const d = rateInfo.value.date.split('-').reverse().join('.')
  return `EZB-Referenzkurs vom ${d}${rateInfo.value.cached ? ' (gespeichert, offline)' : ''}`
})

onMounted(async () => {
  trip.value = await tripRepository.get(props.tripId)
  if (!trip.value) return router.replace('/trip')
  if (!props.id) {
    // Währung: zuletzt benutzte dieser Reise – sonst während der Reise die Landeswährung
    const last = await getMeta<string>(lastCurrencyKey.value, '')
    const running = defaultExpenseDate(trip.value.startDate, trip.value.endDate) === todayIso()
    const currency = last || (running && localCurrencies.value.length === 1 ? localCurrencies.value[0] : trip.value.currency)
    Object.assign(draft, emptyExpenseDraft({ date: defaultExpenseDate(trip.value.startDate, trip.value.endDate), currency }))
    await nextTick() // erst danach auf Änderungen von Währung/Datum reagieren
    ready.value = true
    await loadRate()
    return
  }
  const item = await expenseRepository.get(props.id)
  if (!item) return router.replace(listPath.value)
  const { id: _i, tripId: _t, createdAt: _c, updatedAt: _u, ...rest } = item
  Object.assign(draft, { ...rest, splitAmong: [...rest.splitAmong] })
  rateTouched.value = true // gespeicherten Kurs behalten
  await nextTick()
  ready.value = true
})

watch(
  () => draft.receipt,
  (b) => {
    if (receiptUrl.value) URL.revokeObjectURL(receiptUrl.value)
    receiptUrl.value = b ? URL.createObjectURL(b) : ''
  }
)
onUnmounted(() => receiptUrl.value && URL.revokeObjectURL(receiptUrl.value))

const num = (v: unknown) => (typeof v === 'number' && !Number.isNaN(v) ? v : 0)
const errors = computed(() => validateExpense({ ...draft, amount: num(draft.amount), rate: num(draft.rate) }, tripCurrency.value))
const converted = computed(() =>
  draft.currency !== tripCurrency.value && num(draft.rate) > 0 && num(draft.amount) > 0
    ? formatMoney(inTripCurrency({ amount: num(draft.amount), currency: draft.currency, rate: num(draft.rate) }, tripCurrency.value), tripCurrency.value)
    : ''
)

function toggleSplit(p: string) {
  const i = draft.splitAmong.indexOf(p)
  if (i >= 0) draft.splitAmong.splice(i, 1)
  else draft.splitAmong.push(p)
}

async function addReceipt(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  receiptBusy.value = true
  try {
    draft.receipt = (await resizeBlob(file, 1400, 0.75)).blob
  } finally {
    receiptBusy.value = false
  }
}

async function save() {
  submitted.value = true
  if (Object.keys(errors.value).length) return
  const plain: ExpenseDraft = {
    ...draft,
    amount: num(draft.amount),
    rate: draft.currency === tripCurrency.value ? 1 : num(draft.rate),
    description: draft.description.trim(),
    // Alle angehakt = wie "alle" (leer), damit später hinzugefügte Teilnehmer mitzählen
    splitAmong: draft.splitAmong.length === people.value.length ? [] : [...draft.splitAmong]
  }
  if (props.id) await expenseRepository.update(props.id, plain)
  else await expenseRepository.create(props.tripId, plain)
  await setMeta(lastCurrencyKey.value, plain.currency)
  router.push(listPath.value)
}

async function remove() {
  if (!props.id || !confirm('Diese Ausgabe löschen?')) return
  await expenseRepository.remove(props.id)
  router.replace(listPath.value)
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="id ? 'Ausgabe bearbeiten' : 'Neue Ausgabe'" />

  <form class="row g-3" novalidate @submit.prevent="save">
    <div class="col-7 col-md-4">
      <label for="amount" class="form-label">Betrag</label>
      <input id="amount" v-model.number="draft.amount" type="number" inputmode="decimal" min="0" step="0.01" class="form-control form-control-lg"
             :class="{ 'is-invalid': submitted && errors.amount }" />
      <div class="invalid-feedback">{{ errors.amount }}</div>
    </div>
    <div class="col-5 col-md-3">
      <label for="cur" class="form-label">Währung</label>
      <select id="cur" v-model="draft.currency" class="form-select form-select-lg">
        <option v-for="c in currencyOptions" :key="c" :value="c">{{ c }}{{ localCurrencies.includes(c) ? ` – ${currencyName(c)}` : '' }}</option>
      </select>
    </div>
    <div v-if="draft.currency !== tripCurrency" class="col-12 col-md-5">
      <label for="rate" class="form-label">Kurs: 1 {{ draft.currency }} = … {{ tripCurrency }}</label>
      <div class="input-group">
        <input id="rate" v-model.number="draft.rate" type="number" inputmode="decimal" min="0" step="0.000001" class="form-control"
               :class="{ 'is-invalid': submitted && errors.rate }" @input="rateTouched = true" />
        <button type="button" class="btn btn-outline-secondary" title="EZB-Kurs für diesen Tag holen" aria-label="EZB-Kurs holen" @click="loadRate(true)">
          <i class="bi bi-arrow-repeat" aria-hidden="true"></i>
        </button>
      </div>
      <div class="invalid-feedback d-block">{{ submitted ? errors.rate : '' }}</div>
      <div v-if="rateHint" class="form-text" data-rate-hint>{{ rateHint }}</div>
      <div v-if="converted" class="form-text fw-semibold" data-converted>= {{ converted }}</div>
    </div>

    <div class="col-12 col-md-8">
      <label for="desc" class="form-label">Wofür?</label>
      <input id="desc" v-model="draft.description" class="form-control" placeholder="z. B. Abendessen am Hafen" />
    </div>
    <div class="col-12 col-md-4">
      <label for="date" class="form-label">Tag</label>
      <input id="date" v-model="draft.date" type="date" class="form-control" :class="{ 'is-invalid': submitted && errors.date }" />
    </div>

    <div class="col-12">
      <label class="form-label d-block">Kategorie</label>
      <div class="d-flex flex-wrap gap-2">
        <template v-for="(c, key) in EXPENSE_CATEGORY" :key="key">
          <input :id="`c-${key}`" v-model="draft.category" type="radio" class="btn-check" :value="key" />
          <label class="btn btn-sm btn-outline-secondary" :for="`c-${key}`">
            <i :class="`bi bi-${c.icon} me-1`" aria-hidden="true"></i>{{ c.label }}
          </label>
        </template>
      </div>
    </div>

    <template v-if="people.length">
      <div class="col-12 col-md-6">
        <label class="form-label d-block">Bezahlt von</label>
        <div class="btn-group flex-wrap" role="group" aria-label="Bezahlt von">
          <template v-for="p in ['', ...people]" :key="p || '-'">
            <input :id="`pb-${p || '-'}`" v-model="draft.paidBy" type="radio" class="btn-check" :value="p" />
            <label class="btn btn-outline-primary" :for="`pb-${p || '-'}`">{{ p || 'gemeinsame Kasse' }}</label>
          </template>
        </div>
      </div>
      <div class="col-12 col-md-6">
        <label class="form-label d-block">Für wen? <span class="small text-body-secondary">(nichts gewählt = alle)</span></label>
        <div class="d-flex flex-wrap gap-2">
          <template v-for="p in people" :key="p">
            <input :id="`sp-${p}`" type="checkbox" class="btn-check" :checked="draft.splitAmong.includes(p)" @change="toggleSplit(p)" />
            <label class="btn btn-outline-secondary" :for="`sp-${p}`">{{ p }}</label>
          </template>
        </div>
      </div>
    </template>

    <div class="col-12">
      <label class="form-label d-block">Beleg</label>
      <div v-if="receiptUrl" class="d-flex align-items-start gap-2 mb-2">
        <a :href="receiptUrl" target="_blank" rel="noopener"><img :src="receiptUrl" alt="Beleg" class="receipt" /></a>
        <button type="button" class="btn btn-sm btn-outline-danger" @click="draft.receipt = null">Entfernen</button>
      </div>
      <label class="btn btn-outline-secondary">
        <span v-if="receiptBusy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
        <i v-else class="bi bi-camera me-1" aria-hidden="true"></i>{{ draft.receipt ? 'Anderes Foto' : 'Beleg fotografieren' }}
        <input type="file" accept="image/*" capture="environment" class="d-none" @change="addReceipt" />
      </label>
    </div>

    <div class="col-12 d-flex gap-2">
      <button type="submit" class="btn btn-primary" :disabled="receiptBusy"><i class="bi bi-check-lg me-1" aria-hidden="true"></i>Speichern</button>
      <RouterLink :to="listPath" class="btn btn-outline-secondary">Abbrechen</RouterLink>
      <button v-if="id" type="button" class="btn btn-outline-danger ms-auto" @click="remove">
        <i class="bi bi-trash me-1" aria-hidden="true"></i>Löschen
      </button>
    </div>
  </form>
</template>

<style scoped>
.receipt {
  max-width: 160px;
  max-height: 200px;
  border-radius: var(--bs-border-radius);
  border: 1px solid var(--bs-border-color);
}
</style>
