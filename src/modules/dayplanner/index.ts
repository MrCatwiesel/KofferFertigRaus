import type { AppModule } from '@/core/registry'
import { weatherDayFacts } from './day-facts'
import { todayIso } from '@/core/dates'
import { tripRepository } from '@/modules/trip/public'
import { activityRepository } from '@/modules/activity/public'
import { describeCode } from '@/services/weather'
import { weatherRepository } from './repository'
import { initialDay } from './logic'

/** Modul "Tagesplaner" (Meilenstein M3). */
export const dayplannerModule: AppModule = {
  id: 'dayplanner',
  title: 'Heute',
  icon: 'sun',
  navTo: '/heute',
  order: 12,
  routes: [
    { path: '/heute', name: 'today', component: () => import('./views/TodayView.vue') },
    { path: '/trip/:tripId/tagesplan', name: 'dayplanner', component: () => import('./views/DayPlanner.vue'), props: true }
  ],
  tripSection: {
    phases: ['planung', 'unterwegs'],
    title: 'Tagesplaner & Wetter',
    icon: 'cloud-sun',
    to: (tripId) => `/trip/${tripId}/tagesplan`,
    async summary(tripId) {
      const [trip, cache, acts] = await Promise.all([
        tripRepository.get(tripId),
        weatherRepository.get(tripId),
        activityRepository.listByTrip(tripId)
      ])
      if (!trip) return ''
      const day = initialDay(trip.startDate, trip.endDate)
      const w = cache?.days.find((d) => d.date === day)
      const plannedDays = new Set(acts.filter((a) => a.plannedDate && a.status !== 'verworfen').map((a) => a.plannedDate)).size
      const parts: string[] = []
      if (w) parts.push(`${day === todayIso() ? 'Heute' : 'Am ersten Tag'}: ${describeCode(w.code).label}, ${Math.round(w.tempMax)}°`)
      else if (!cache) parts.push('Ort fürs Wetter festlegen')
      parts.push(`${plannedDays} ${plannedDays === 1 ? 'Tag' : 'Tage'} mit Programm`)
      return parts.join(' · ')
    }
  },
  dayFacts: async (tripId, date) => weatherDayFacts((await weatherRepository.get(tripId))?.days, date),
  onTripDelete: (tripId) => weatherRepository.remove(tripId),
  // Beispielreise: erst beim Anlegen nachladen (nicht im Startpaket)
  sampleData: (s) => import('./sample').then((m) => m.dayplannerSample(s))
}
