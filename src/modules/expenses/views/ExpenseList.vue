<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLiveQuery } from '@/core/composables'
import { formatDayShort, formatMoney } from '@/core/format'
import { TripContextHeader, participantsOf, tripRepository, type Trip } from '@/modules/trip/public'
import { expenseRepository } from '../repository'
import { balances, defaultExpenseDate, emptyExpenseDraft, inTripCurrency, parseQuickExpense, settle, sortExpenses, summarize } from '../logic'
import { EXPENSE_CATEGORY, type Expense, type ExpenseCategory } from '../types'

const props = defineProps<{ tripId: string }>()

const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const list = useLiveQuery(() => expenseRepository.listByTrip(props.tripId), [] as Expense[])

const currency = computed(() => trip.value?.currency ?? 'EUR')
const people = computed(() => participantsOf(trip.value))
const summary = computed(() => (trip.value ? summarize(list.value, currency.value, trip.value.startDate, trip.value.endDate) : null))
const bal = computed(() => balances(list.value, people.value, currency.value))
const transfers = computed(() => settle(bal.value))
const hasPayers = computed(() => list.value.some((e) => e.paidBy))
const budgetPct = computed(() => (trip.value?.budget && summary.value ? Math.round((summary.value.total / trip.value.budget) * 100) : null))
const maxCategory = computed(() => Math.max(1, ...(summary.value?.byCategory.map((c) => c.amount) ?? [1])))

const grouped = computed(() => {
  const m = new Map<string, Expense[]>()
  for (const e of sortExpenses(list.value)) m.set(e.date, [...(m.get(e.date) ?? []), e])
  return [...m.entries()]
})

// Schnelleingabe
const quick = ref('')
const quickCategory = ref<ExpenseCategory>('essen')
const quickPayer = ref('')
const quickError = ref('')

async function quickAdd() {
  quickError.value = ''
  const parsed = parseQuickExpense(quick.value)
  if (!parsed || !trip.value) {
    quickError.value = 'Bitte einen Betrag eingeben, z. B. „12,50 Eis“.'
    return
  }
  await expenseRepository.create(
    props.tripId,
    emptyExpenseDraft({
      ...parsed,
      date: defaultExpenseDate(trip.value.startDate, trip.value.endDate),
      currency: currency.value,
      category: quickCategory.value,
      paidBy: quickPayer.value
    })
  )
  quick.value = ''
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="t('Ausgaben')" />

  <!-- Überblick -->
  <div v-if="summary && list.length" class="card mb-3">
    <div class="card-body">
      <div class="d-flex justify-content-between align-items-baseline flex-wrap gap-2">
        <div>
          <div class="small text-body-secondary">{{ t('Ausgegeben') }}</div>
          <div class="fs-3 fw-semibold">{{ formatMoney(summary.total, currency) }}</div>
        </div>
        <div class="text-end small">
          <div>{{ t('Ø {perDay} pro Tag', { perDay: formatMoney(summary.perDay, currency) }) }}</div>
          <div class="text-body-secondary">{{ t('Hochgerechnet: {projected}', { projected: formatMoney(summary.projected, currency) }) }}</div>
        </div>
      </div>
      <template v-if="trip?.budget && budgetPct !== null">
        <div class="progress mt-2" style="height: 10px" role="progressbar" :aria-valuenow="budgetPct" aria-valuemin="0" aria-valuemax="100" :aria-label="t('Budget')">
          <div class="progress-bar" :class="budgetPct > 100 ? 'bg-danger' : budgetPct > 85 ? 'bg-warning' : 'bg-success'"
               :style="{ width: `${Math.min(100, budgetPct)}%` }"></div>
        </div>
        <div class="small mt-1" :class="summary.projected > trip.budget ? 'text-danger' : 'text-body-secondary'">
          {{ t('{budgetPct} % von {budget}', { budgetPct, budget: formatMoney(trip.budget, currency) }) }}
          <template v-if="summary.projected > trip.budget"> {{ t('– bei diesem Tempo wird das Budget überschritten') }}</template>
        </div>
      </template>
    </div>
  </div>

  <!-- Schnell erfassen -->
  <form class="card mb-3" @submit.prevent="quickAdd">
    <div class="card-body">
      <div class="input-group mb-2">
        <input v-model="quick" class="form-control" inputmode="text" :placeholder="t('z. B. „23,50 Pizza“')" :aria-label="t('Betrag und Beschreibung')" />
        <button class="btn btn-primary" type="submit" :aria-label="t('Hinzufügen')"><i class="bi bi-plus-lg" aria-hidden="true"></i></button>
      </div>
      <div class="d-flex flex-wrap gap-1 mb-1">
        <template v-for="(c, key) in EXPENSE_CATEGORY" :key="key">
          <input :id="`qc-${key}`" v-model="quickCategory" type="radio" class="btn-check" :value="key" />
          <label class="btn btn-sm btn-outline-secondary" :for="`qc-${key}`" :title="c.label">
            <i :class="`bi bi-${c.icon}`" aria-hidden="true"></i><span class="visually-hidden">{{ c.label }}</span>
          </label>
        </template>
      </div>
      <div v-if="people.length" class="d-flex flex-wrap gap-1 align-items-center small">
        <span class="text-body-secondary me-1">{{ t('Bezahlt von:') }}</span>
        <template v-for="p in ['', ...people]" :key="p || '-'">
          <input :id="`qp-${p || '-'}`" v-model="quickPayer" type="radio" class="btn-check" :value="p" />
          <label class="btn btn-sm btn-outline-secondary py-0" :for="`qp-${p || '-'}`">{{ p || '–' }}</label>
        </template>
      </div>
      <div v-if="quickError" class="small text-danger mt-1">{{ quickError }}</div>
      <div class="d-flex justify-content-end mt-1">
        <RouterLink :to="`/trip/${tripId}/ausgaben/neu`" class="small">{{ t('Mit Beleg, Fremdwährung oder Aufteilung …') }}</RouterLink>
      </div>
    </div>
  </form>

  <p v-if="list.length === 0" class="text-body-secondary small">
    {{ t('Tipp: Betrag und Stichwort eintippen, Kategorie antippen, fertig. Mit Teilnehmern rechnet die App am Ende aus, wer wem was schuldet.') }}
  </p>

  <!-- Kategorien -->
  <section v-if="summary && summary.byCategory.length" class="mb-3">
    <h2 class="h6 text-body-secondary">{{ t('Nach Kategorie') }}</h2>
    <div v-for="c in summary.byCategory" :key="c.category" class="mb-1">
      <div class="d-flex justify-content-between small">
        <span><i :class="`bi bi-${EXPENSE_CATEGORY[c.category].icon} me-1`" aria-hidden="true"></i>{{ EXPENSE_CATEGORY[c.category].label }}</span>
        <span>{{ formatMoney(c.amount, currency) }}</span>
      </div>
      <div class="cat-bar"><div :style="{ width: `${(c.amount / maxCategory) * 100}%`, background: EXPENSE_CATEGORY[c.category].color }"></div></div>
    </div>
  </section>

  <!-- Ausgleich -->
  <section v-if="people.length > 1 && hasPayers" class="card mb-3">
    <div class="card-body">
      <h2 class="h6">{{ t('Ausgleich') }}</h2>
      <table class="table table-sm small mb-2">
        <thead><tr><th>{{ t('Person') }}</th><th class="text-end">{{ t('bezahlt') }}</th><th class="text-end">{{ t('Anteil') }}</th><th class="text-end">{{ t('Saldo') }}</th></tr></thead>
        <tbody>
          <tr v-for="b in bal" :key="b.person">
            <td>{{ b.person }}</td>
            <td class="text-end">{{ formatMoney(b.paid, currency) }}</td>
            <td class="text-end">{{ formatMoney(b.share, currency) }}</td>
            <td class="text-end" :class="b.net < 0 ? 'text-danger' : b.net > 0 ? 'text-success' : ''">{{ formatMoney(b.net, currency) }}</td>
          </tr>
        </tbody>
      </table>
      <div v-if="transfers.length === 0" class="small text-success"><i class="bi bi-check-circle me-1" aria-hidden="true"></i>{{ t('Alle sind quitt.') }}</div>
      <div v-for="tr in transfers" :key="`${tr.from}-${tr.to}`" class="small">
        <i class="bi bi-arrow-right-circle me-1 text-primary" aria-hidden="true"></i>
        <strong>{{ tr.from }}</strong> {{ t('gibt') }} <strong>{{ tr.to }}</strong> {{ formatMoney(tr.amount, currency) }}
      </div>
    </div>
  </section>

  <!-- Liste -->
  <section v-for="[date, items] in grouped" :key="date" class="mb-3">
    <h2 class="h6 text-body-secondary d-flex justify-content-between">
      <span>{{ formatDayShort(date) }}</span>
      <span>{{ formatMoney(summary?.byDay.find((d) => d.date === date)?.amount ?? 0, currency) }}</span>
    </h2>
    <div class="list-group">
      <RouterLink v-for="e in items" :key="e.id" :to="`/trip/${tripId}/ausgaben/${e.id}`"
                  class="list-group-item list-group-item-action d-flex align-items-center gap-3">
        <span class="cat-dot" :style="{ background: EXPENSE_CATEGORY[e.category].color }">
          <i :class="`bi bi-${EXPENSE_CATEGORY[e.category].icon}`" aria-hidden="true"></i>
        </span>
        <div class="flex-grow-1 min-w-0">
          <div class="text-truncate">{{ e.description || EXPENSE_CATEGORY[e.category].label }}</div>
          <div class="small text-body-secondary">
            <template v-if="e.paidBy">{{ t('{paidBy} hat bezahlt', { paidBy: e.paidBy }) }}</template>
            <template v-if="e.splitAmong.length"> {{ t('· für {join}', { join: e.splitAmong.join(', ') }) }}</template>
            <i v-if="e.receipt" class="bi bi-receipt ms-1" :title="t('Beleg vorhanden')" :aria-label="t('Beleg vorhanden')"></i>
          </div>
        </div>
        <div class="text-end">
          <div class="fw-semibold">{{ formatMoney(inTripCurrency(e, currency), currency) }}</div>
          <div v-if="e.currency !== currency" class="small text-body-secondary">{{ formatMoney(e.amount, e.currency) }}</div>
        </div>
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.cat-bar {
  height: 6px;
  background: var(--bs-secondary-bg);
  border-radius: 3px;
  overflow: hidden;
}
.cat-bar > div {
  height: 100%;
  border-radius: 3px;
}
.cat-dot {
  width: 2.2rem;
  height: 2.2rem;
  flex: none;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: #fff;
}
.min-w-0 {
  min-width: 0;
}
</style>
