import type { AppModule } from '@/core/registry'
import { travelDayFacts } from './day-facts'
import { tripRepository } from '@/modules/trip/public'
import { travelRepository } from './repository'
import { formatDuration, summarize, totalCost } from './logic'
import { travelReminders } from './reminders'

/** Modul "Anreise" (Meilenstein M1). */
export const travelModule: AppModule = {
  id: 'travel',
  title: 'Anreise',
  icon: 'signpost-split',
  order: 15,
  routes: [
    { path: '/trip/:tripId/anreise', name: 'travel-list', component: () => import('./views/TravelList.vue'), props: true },
    { path: '/trip/:tripId/anreise/neu', name: 'travel-new', component: () => import('./views/TravelEdit.vue'), props: true },
    { path: '/trip/:tripId/anreise/:id', name: 'travel-edit', component: () => import('./views/TravelEdit.vue'), props: true }
  ],
  reminders: async (trip) => travelReminders(await travelRepository.listByTrip(trip.id), trip),
  tripSection: {
    phases: ['planung', 'unterwegs'],
    title: 'An- und Rückreise',
    icon: 'signpost-split',
    to: (tripId) => `/trip/${tripId}/anreise`,
    async summary(tripId) {
      const [trip, list] = await Promise.all([tripRepository.get(tripId), travelRepository.listByTrip(tripId)])
      if (!trip || list.length === 0) return 'Noch nicht geplant'
      const hin = summarize(list, 'hin', trip.currency)
      const rueck = summarize(list, 'rueck', trip.currency)
      const part = (label: string, s: typeof hin) => {
        if (s.legs === 0) return `${label}: offen`
        const bits = [`${s.legs} ${s.legs === 1 ? 'Etappe' : 'Etappen'}`]
        if (s.distanceKm) bits.push(`${Math.round(s.distanceKm)} km`)
        if (s.travelMinutes) bits.push(formatDuration(s.travelMinutes))
        return `${label}: ${bits.join(', ')}`
      }
      return `${part('Hin', hin)} · ${part('Rück', rueck)}`
    },
    async plannedCost(tripId) {
      const [trip, list] = await Promise.all([tripRepository.get(tripId), travelRepository.listByTrip(tripId)])
      return trip ? totalCost(list, trip.currency) : 0
    }
  },
  dayFacts: async (tripId, date) => travelDayFacts(await travelRepository.listByTrip(tripId), date),
  onTripDelete: (tripId) => travelRepository.removeByTrip(tripId),
  // Beispielreise: erst beim Anlegen nachladen (nicht im Startpaket)
  sampleData: (s) => import('./sample').then((m) => m.travelSample(s))
}
