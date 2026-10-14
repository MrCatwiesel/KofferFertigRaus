import type { AppModule } from '@/core/registry'
import { getReminders } from '@/core/registry'
import { groupOf } from '@/core/reminders'
import { todayIso } from '@/core/dates'
import { formatDate } from '@/core/format'
import { tripRepository } from '@/modules/trip/public'
import { asReminderTrip, startCalendarSync } from './calendar'
import { startPushSchedule } from './push-zeitplan'

/** Modul „Termine & Fristen“: sammelt, was die anderen Bereiche an Daten kennen – und gibt es an den Kalender. */
export const termineModule: AppModule = {
  id: 'termine',
  title: 'Termine & Fristen',
  icon: 'calendar-check',
  order: 13,
  routes: [{ path: '/trip/:tripId/termine', name: 'termine', component: () => import('./views/TermineView.vue'), props: true }],
  // Die Reise selbst als Termin (mehrtägig)
  reminders: async (trip) => [
    { id: `trip:${trip.id}`, tripId: trip.id, date: trip.startDate, endDate: trip.endDate, kind: 'reise', title: `Reise: ${trip.title}`, location: trip.destination || undefined, to: `/trip/${trip.id}` }
  ],
  tripSection: {
    phases: ['planung', 'unterwegs'],
    title: 'Termine & Fristen',
    icon: 'calendar-check',
    to: (tripId) => `/trip/${tripId}/termine`,
    async summary(tripId) {
      const trip = await tripRepository.get(tripId)
      if (!trip) return ''
      const today = todayIso()
      const list = (await getReminders(asReminderTrip(trip), today)).filter((r) => r.id !== `trip:${tripId}`)
      const overdue = list.filter((r) => groupOf(r, today) === 'ueberfaellig').length
      const next = list.find((r) => (r.endDate ?? r.date) >= today)
      const parts: string[] = []
      if (overdue) parts.push(`${overdue} überfällig`)
      if (next) parts.push(`Nächstes: ${next.title} (${next.date === today ? 'heute' : formatDate(next.date)})`)
      return parts.join(' · ') || 'Keine offenen Termine – Kalender-Abo möglich'
    }
  },
  onStart: () => {
    startCalendarSync()
    startPushSchedule()
  }
}
