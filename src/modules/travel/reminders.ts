import { shiftDate, type Reminder, type ReminderTrip } from '@/core/reminders'
import { MODE, type TravelLeg } from './types'

/** Abfahrt jeder Etappe; bei Flügen zusätzlich der Online-Check-in (meist 24–48 h vorher möglich) */
export function travelReminders(legs: TravelLeg[], trip: ReminderTrip): Reminder[] {
  const out: Reminder[] = []
  for (const l of legs) {
    if (!l.date) continue
    const route = [l.from, l.to].filter(Boolean).join(' → ') || (l.direction === 'hin' ? 'Anreise' : 'Rückreise')
    const to = `/trip/${trip.id}/anreise`
    out.push({
      id: `leg:${l.id}`, tripId: trip.id, date: l.date, time: l.departTime || undefined, endTime: l.arriveTime && l.arriveTime > l.departTime ? l.arriveTime : undefined,
      kind: 'termin', title: `${MODE[l.mode].label}: ${route}`, location: l.from || undefined, detail: l.bookingRef ? `Buchung ${l.bookingRef}` : undefined,
      alarmMinutes: l.mode === 'flug' ? 180 : l.departTime ? 120 : undefined, to
    })
    if (l.mode === 'flug')
      out.push({ id: `leg:${l.id}:checkin`, tripId: trip.id, date: shiftDate(l.date, -1), time: l.departTime || undefined, kind: 'frist', title: `Online-Check-in: ${route}`, alarmMinutes: 0, to })
  }
  return out
}
