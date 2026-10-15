import { notBefore, shiftDate, type Reminder, type ReminderTrip } from '@/core/reminders'
import { formatDate } from '@/core/format'
import { needsRenewalSoon, validity } from './logic'
import { DOC_TYPE, type TravelDocument } from './types'
import { t } from '@/i18n'

/**
 * Ausweise/Pässe, die vor oder kurz nach der Reise ablaufen → rechtzeitig verlängern (6 Wochen vorher, Bearbeitungszeit).
 * Fehlende Dokumente → 2 Wochen vor Abreise. Nur bis zum Ende der Reise.
 */
export function documentReminders(list: TravelDocument[], trip: ReminderTrip, today: string, now = new Date()): Reminder[] {
  if (trip.endDate < today) return []
  const out: Reminder[] = []
  for (const d of list) {
    const to = `/trip/${trip.id}/dokumente/${d.id}`
    const who = d.person ? ` (${d.person})` : ''
    if (d.status === 'fehlt')
      out.push({ id: `doc:${d.id}:fehlt`, tripId: trip.id, date: notBefore(shiftDate(trip.startDate, -14), today), kind: 'pruefen', title: t('Besorgen: {name}', { name: (d.title || DOC_TYPE[d.type].label) + who }), to })
    else if (needsRenewalSoon(d, trip.startDate, trip.endDate, now)) {
      const v = validity(d, trip.endDate, now)
      const why = v === 'abgelaufen' ? t('abgelaufen') : t('gültig bis {date}', { date: formatDate(d.validUntil) })
      out.push({ id: `doc:${d.id}:verlaengern`, tripId: trip.id, date: notBefore(shiftDate(trip.startDate, -42), today), kind: 'pruefen', title: t('Verlängern: {name} – {why}', { name: (d.title || DOC_TYPE[d.type].label) + who, why }), to })
    }
  }
  return out
}
