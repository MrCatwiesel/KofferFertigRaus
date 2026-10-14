import type { AppModule } from '@/core/registry'
import { expenseDayFacts } from './day-facts'
import { formatMoney } from '@/core/format'
import { tripRepository } from '@/modules/trip/public'
import { expenseRepository } from './repository'
import { summarize } from './logic'

/** Modul "Ausgaben" (unterwegs). */
export const expensesModule: AppModule = {
  id: 'expenses',
  title: 'Ausgaben',
  icon: 'wallet2',
  order: 55,
  routes: [
    { path: '/trip/:tripId/ausgaben', name: 'expenses', component: () => import('./views/ExpenseList.vue'), props: true },
    { path: '/trip/:tripId/ausgaben/neu', name: 'expense-new', component: () => import('./views/ExpenseEdit.vue'), props: true },
    { path: '/trip/:tripId/ausgaben/:id', name: 'expense-edit', component: () => import('./views/ExpenseEdit.vue'), props: true }
  ],
  tripSection: {
    phases: ['planung', 'unterwegs', 'danach'],
    title: 'Ausgaben',
    icon: 'wallet2',
    to: (tripId) => `/trip/${tripId}/ausgaben`,
    async summary(tripId) {
      const [trip, list] = await Promise.all([tripRepository.get(tripId), expenseRepository.listByTrip(tripId)])
      if (!trip || list.length === 0) return 'Noch nichts ausgegeben'
      const s = summarize(list, trip.currency, trip.startDate, trip.endDate)
      const parts = [`${formatMoney(s.total, trip.currency)} ausgegeben`, `Ø ${formatMoney(s.perDay, trip.currency)}/Tag`]
      if (trip.budget) parts.push(`${Math.round((s.total / trip.budget) * 100)} % vom Budget`)
      return parts.join(' · ')
    }
  },
  async dayFacts(tripId, date) {
    const [trip, list] = await Promise.all([tripRepository.get(tripId), expenseRepository.listByTrip(tripId)])
    return trip ? expenseDayFacts(list, date, trip.currency) : []
  },
  onTripDelete: (tripId) => expenseRepository.removeByTrip(tripId)
}
