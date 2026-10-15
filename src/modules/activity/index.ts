import type { AppModule } from '@/core/registry'
import { activityDayFacts } from './day-facts'
import { tripRepository } from '@/modules/trip/public'
import { activityRepository } from './repository'
import { countByStatus, totalEstimatedCost } from './logic'
import { activityReminders } from './reminders'
import { activitySample } from './sample'

/** Modul "Unternehmungen" (Meilenstein M1). */
export const activityModule: AppModule = {
  id: 'activity',
  title: 'Unternehmungen',
  icon: 'star',
  order: 30,
  routes: [
    { path: '/trip/:tripId/unternehmungen', name: 'activity-list', component: () => import('./views/ActivityList.vue'), props: true },
    { path: '/trip/:tripId/unternehmungen/neu', name: 'activity-new', component: () => import('./views/ActivityEdit.vue'), props: true },
    { path: '/trip/:tripId/unternehmungen/:id', name: 'activity-edit', component: () => import('./views/ActivityEdit.vue'), props: true }
  ],
  reminders: async (trip, today) => activityReminders(await activityRepository.listByTrip(trip.id), trip, today),
  tripSection: {
    phases: ['planung', 'unterwegs'],
    title: 'Unternehmungen',
    icon: 'star',
    to: (tripId) => `/trip/${tripId}/unternehmungen`,
    async summary(tripId) {
      const list = await activityRepository.listByTrip(tripId)
      if (list.length === 0) return 'Noch keine Ideen'
      const c = countByStatus(list)
      const parts = [`${c.idee} ${c.idee === 1 ? 'Idee' : 'Ideen'}`, `${c.geplant} geplant`]
      if (c.erledigt) parts.push(`${c.erledigt} erledigt`)
      return parts.join(' · ')
    },
    async plannedCost(tripId) {
      const [trip, list] = await Promise.all([tripRepository.get(tripId), activityRepository.listByTrip(tripId)])
      return trip ? totalEstimatedCost(list, trip.travelers, trip.currency) : 0
    }
  },
  dayFacts: async (tripId, date) => activityDayFacts(await activityRepository.listByTrip(tripId), date),
  onTripDelete: (tripId) => activityRepository.removeByTrip(tripId),
  sampleData: activitySample
}
