import { notBefore, shiftDate, type Reminder, type ReminderTrip } from '@/core/reminders'
import { expiryStatus, vaccinationNeedsAction } from './logic'
import type { Medication, Vaccination } from './types'
import { t } from '@/core/i18n'

/** Impftermine, zu klärende Impfungen (6 Wochen vorher), Medikamente, die vor Reiseende ablaufen */
export function medsReminders(meds: Medication[], vaccs: Vaccination[], trip: ReminderTrip, today: string, now = new Date()): Reminder[] {
  if (trip.endDate < today) return []
  const out: Reminder[] = []
  for (const v of vaccs) {
    const to = `/trip/${trip.id}/apotheke/impfung/${v.id}`
    const who = v.person ? ` (${v.person})` : ''
    if (v.status === 'geplant' && v.date) out.push({ id: `vacc:${v.id}`, tripId: trip.id, date: v.date, kind: 'termin', title: t('Impftermin: {0}{1}', [v.name, who]), to })
    else if (v.status === 'pruefen' || vaccinationNeedsAction(v, trip.endDate))
      out.push({ id: `vacc:${v.id}:pruefen`, tripId: trip.id, date: notBefore(shiftDate(trip.startDate, -42), today), kind: 'pruefen', title: t('Impfung klären: {0}{1}', [v.name, who]), to })
  }
  for (const m of meds) {
    const s = expiryStatus(m.expiryDate, trip.endDate, now)
    if (s === 'abgelaufen' || s === 'waehrend')
      out.push({ id: `med:${m.id}:ablauf`, tripId: trip.id, date: notBefore(shiftDate(trip.startDate, -7), today), kind: 'pruefen', title: t('Ersetzen: {0} (läuft ab)', [m.name]), to: `/trip/${trip.id}/apotheke/medikament/${m.id}` })
  }
  return out
}
