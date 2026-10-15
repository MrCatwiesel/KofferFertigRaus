import type { Reminder, ReminderTrip } from '@/core/reminders'
import { MODE, type TravelLeg } from './types'
import { t } from '@/i18n'

/** Abfahrt jeder Etappe (den Online-Check-in vor Flügen liefert das Modul „Abreise-Checklisten“) */
export function travelReminders(legs: TravelLeg[], trip: ReminderTrip): Reminder[] {
  const out: Reminder[] = []
  for (const l of legs) {
    if (!l.date) continue
    const route = [l.from, l.to].filter(Boolean).join(' → ') || (l.direction === 'hin' ? t('Anreise') : t('Rückreise'))
    const to = `/trip/${trip.id}/anreise`
    out.push({
      id: `leg:${l.id}`, tripId: trip.id, date: l.date, time: l.departTime || undefined, endTime: l.arriveTime && l.arriveTime > l.departTime ? l.arriveTime : undefined,
      kind: 'termin', title: `${MODE[l.mode].label}: ${route}`, location: l.from || undefined, detail: l.bookingRef ? t('Buchung {bookingRef}', { bookingRef: l.bookingRef }) : undefined,
      alarmMinutes: l.mode === 'flug' ? 180 : l.departTime ? 120 : undefined, to
    })
  }
  return out
}
