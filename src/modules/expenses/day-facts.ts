import type { DayFact } from '@/core/registry'
import { formatMoney } from '@/core/format'
import { inTripCurrency } from './logic'
import type { Expense } from './types'
import { t } from '@/core/i18n'

/** Summe der Ausgaben des Tages (in der Reisewährung) */
export function expenseDayFacts(expenses: readonly Expense[], date: string, currency: string): DayFact[] {
  const day = expenses.filter((e) => e.date === date)
  if (!day.length) return []
  const sum = day.reduce((s, e) => s + inTripCurrency(e, currency), 0)
  return [{ order: 60, text: t('Ausgaben: {0} ({1} Posten).', [formatMoney(sum, currency), day.length]) }]
}
