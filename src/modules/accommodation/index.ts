import type { AppModule } from '@/core/registry'
import { stayDayFacts } from './day-facts'
import { tripRepository } from '@/modules/trip/public'
import { accommodationRepository } from './repository'
import { coverage, totalCost } from './logic'
import { accommodationReminders } from './reminders'
import { t } from '@/i18n'

/** Modul "Unterkünfte" (Meilenstein M1). */
export const accommodationModule: AppModule = {
  id: 'accommodation',
  title: t('Unterkünfte'),
  icon: 'house-door',
  order: 20,
  routes: [
    { path: '/trip/:tripId/unterkuenfte', name: 'accommodation-list', component: () => import('./views/AccommodationList.vue'), props: true },
    { path: '/trip/:tripId/unterkuenfte/neu', name: 'accommodation-new', component: () => import('./views/AccommodationEdit.vue'), props: true },
    { path: '/trip/:tripId/unterkuenfte/:id', name: 'accommodation-edit', component: () => import('./views/AccommodationEdit.vue'), props: true }
  ],
  reminders: async (trip, today) => accommodationReminders(await accommodationRepository.listByTrip(trip.id), trip, today),
  tripSection: {
    phases: ['planung', 'unterwegs'],
    title: t('Unterkünfte'),
    icon: 'house-door',
    to: (tripId) => `/trip/${tripId}/unterkuenfte`,
    async summary(tripId) {
      const [trip, list] = await Promise.all([tripRepository.get(tripId), accommodationRepository.listByTrip(tripId)])
      if (!trip || list.length === 0) return t('Noch keine Unterkunft')
      const c = coverage(trip.startDate, trip.endDate, list)
      return c.totalNights === 0 ? t('{n} erfasst', { n: list.length }) : t('{booked} von {total} Nächten gebucht', { booked: c.bookedNights, total: c.totalNights })
    },
    async plannedCost(tripId) {
      const [trip, list] = await Promise.all([tripRepository.get(tripId), accommodationRepository.listByTrip(tripId)])
      return trip ? totalCost(list, trip.currency) : 0
    }
  },
  dayFacts: async (tripId, date) => stayDayFacts(await accommodationRepository.listByTrip(tripId), date),
  onTripDelete: (tripId) => accommodationRepository.removeByTrip(tripId),
  // Beispielreise: erst beim Anlegen nachladen (nicht im Startpaket)
  sampleData: (s) => import('./sample').then((m) => m.accommodationSample(s))
}
