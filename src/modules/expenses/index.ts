import type { AppModule } from '@/core/registry'
import { expenseDayFacts } from './day-facts'
import { formatMoney } from '@/core/format'
import { tripRepository } from '@/modules/trip/public'
import { expenseRepository } from './repository'
import { summarize } from './logic'
import { N_, t } from '@/core/i18n'

/** Modul "Ausgaben" (unterwegs). */
export const expensesModule: AppModule = {
  id: 'expenses',
  title: N_('Ausgaben'),
  icon: 'wallet2',
  order: 55,
  routes: [
    { path: '/trip/:tripId/ausgaben', name: 'expenses', component: () => import('./views/ExpenseList.vue'), props: true },
    { path: '/trip/:tripId/ausgaben/neu', name: 'expense-new', component: () => import('./views/ExpenseEdit.vue'), props: true },
    { path: '/trip/:tripId/ausgaben/:id', name: 'expense-edit', component: () => import('./views/ExpenseEdit.vue'), props: true }
  ],
  tripSection: {
    phases: ['planung', 'unterwegs', 'danach'],
    title: N_('Ausgaben'),
    icon: 'wallet2',
    to: (tripId) => `/trip/${tripId}/ausgaben`,
    async summary(tripId) {
      const [trip, list] = await Promise.all([tripRepository.get(tripId), expenseRepository.listByTrip(tripId)])
      if (!trip || list.length === 0) return t('Noch nichts ausgegeben')
      const s = summarize(list, trip.currency, trip.startDate, trip.endDate)
      const parts = [t('{0} ausgegeben', [formatMoney(s.total, trip.currency)]), t('Ø {0}/Tag', [formatMoney(s.perDay, trip.currency)])]
      if (trip.budget) parts.push(t('{0} % vom Budget', [Math.round((s.total / trip.budget) * 100)]))
      return parts.join(' · ')
    }
  },
  async dayFacts(tripId, date) {
    const [trip, list] = await Promise.all([tripRepository.get(tripId), expenseRepository.listByTrip(tripId)])
    return trip ? expenseDayFacts(list, date, trip.currency) : []
  },
  onTripDelete: (tripId) => expenseRepository.removeByTrip(tripId)
}
