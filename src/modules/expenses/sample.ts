import type { SampleTrip } from '@/core/sample'
import { expenseRepository } from './repository'
import { emptyExpenseDraft } from './logic'
import type { ExpenseDraft } from './types'

/** Beispielreise: Ausgaben der ersten Tage, abwechselnd bezahlt – so zeigt „Ausgleich“ etwas */
export async function expensesSample(s: SampleTrip): Promise<void> {
  const [a, b] = s.participants
  const list: Partial<ExpenseDraft>[] = [
    { date: s.day(0), amount: 78.4, category: 'anreise', description: 'Tanken', paidBy: a },
    { date: s.day(0), amount: 32, category: 'anreise', description: 'Maut Brenner', paidBy: b },
    { date: s.day(0), amount: 64.9, category: 'einkauf', description: 'Einkauf Supermarkt', paidBy: b },
    { date: s.day(1), amount: 52, category: 'aktivitaet', description: 'Seilbahn Monte Baldo', paidBy: a },
    { date: s.day(1), amount: 46.5, category: 'essen', description: 'Pizza am Abend', paidBy: b },
    { date: s.day(2), amount: 7.4, category: 'essen', description: 'Cappuccino', paidBy: a }
  ]
  for (const d of list) await expenseRepository.create(s.tripId, { ...emptyExpenseDraft({ currency: s.currency }), ...d })
}
