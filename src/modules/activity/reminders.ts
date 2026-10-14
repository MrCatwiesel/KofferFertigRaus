import { notBefore, shiftDate, type Reminder, type ReminderTrip } from '@/core/reminders'
import type { Activity } from './types'
import { t } from '@/core/i18n'

/** Geplante Unternehmungen am Tag; „Buchung nötig“ eine Woche vorher als Aufgabe */
export function activityReminders(list: Activity[], trip: ReminderTrip, today: string): Reminder[] {
  const out: Reminder[] = []
  for (const a of list) {
    if (a.status !== 'geplant' && a.status !== 'idee') continue
    const to = `/trip/${trip.id}/unternehmungen/${a.id}`
    if (a.status === 'geplant' && a.plannedDate)
      out.push({ id: `act:${a.id}`, tripId: trip.id, date: a.plannedDate, kind: 'termin', title: a.title, location: a.place || undefined, detail: a.openingHours || undefined, to })
    if (a.bookingRequired && a.status === 'geplant' && (!a.plannedDate || a.plannedDate >= today))
      out.push({
        id: `act:${a.id}:buchen`, tripId: trip.id, date: notBefore(shiftDate(a.plannedDate || trip.startDate, -7), today),
        kind: 'pruefen', title: t('Buchen: {0}', [a.title]), detail: a.url || undefined, to
      })
  }
  return out
}
