/** Öffentliche Schnittstelle des Moduls "Ausgaben" (z. B. für Reisebericht und Statistik). */
export { expenseRepository } from './repository'
export { inTripCurrency, summarize } from './logic'
export { EXPENSE_CATEGORY } from './types'
export type { Expense } from './types'
