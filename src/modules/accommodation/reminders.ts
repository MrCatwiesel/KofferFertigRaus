import type { Reminder, ReminderTrip } from '@/core/reminders'
import type { Accommodation } from './types'

/** Stornofrist (gebuchte), Check-in (gebuchte) und „noch keine Antwort“ (angefragte) */
export function accommodationReminders(list: Accommodation[], trip: ReminderTrip, today: string): Reminder[] {
  const out: Reminder[] = []
  for (const a of list) {
    const to = `/trip/${trip.id}/unterkuenfte/${a.id}`
    if (a.status === 'gebucht' && a.cancelUntil)
      out.push({ id: `acc:${a.id}:storno`, tripId: trip.id, date: a.cancelUntil, kind: 'frist', title: `Kostenlos stornierbar bis heute: ${a.name}`, detail: a.bookingRef ? `Buchungsnummer ${a.bookingRef}` : undefined, to })
    if (a.status === 'gebucht' && a.checkIn)
      out.push({
        id: `acc:${a.id}:checkin`, tripId: trip.id, date: a.checkIn, endDate: a.checkOut && a.checkOut > a.checkIn ? a.checkOut : undefined,
        kind: 'reise', title: `Unterkunft: ${a.name}`, location: a.address || undefined, detail: a.bookingRef ? `Buchungsnummer ${a.bookingRef}` : undefined, to
      })
    if (a.status === 'angefragt' && a.checkIn > today)
      out.push({ id: `acc:${a.id}:anfrage`, tripId: trip.id, date: today, kind: 'pruefen', title: `Antwort abwarten oder nachfragen: ${a.name}`, to })
  }
  return out
}
