import type { DayFact } from '@/core/registry'
import { formatMoney } from '@/core/format'
import { inTripCurrency } from './logic'
import type { Expense } from './types'

/** Summe der Ausgaben des Tages (in der Reisewährung) */
export function expenseDayFacts(expenses: readonly Expense[], date: string, currency: string): DayFact[] {
  const day = expenses.filter((e) => e.date === date)
  if (!day.length) return []
  const sum = day.reduce((s, e) => s + inTripCurrency(e, currency), 0)
  return [{ order: 60, text: `Ausgaben: ${formatMoney(sum, currency)} (${day.length} Posten).` }]
}
