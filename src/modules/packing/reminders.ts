import { shiftDate, type Reminder, type ReminderTrip } from '@/core/reminders'
import type { PackingItem } from './types'
import { t } from '@/core/i18n'

/** Zwei Tage vor Abreise: Packliste, solange noch etwas fehlt */
export function packingReminders(items: PackingItem[], trip: ReminderTrip, today: string): Reminder[] {
  const open = items.filter((i) => !i.packed).length
  if (!items.length || !open || trip.startDate < today) return []
  return [{ id: `pack:${trip.id}`, tripId: trip.id, date: shiftDate(trip.startDate, -2), kind: 'pruefen', title: t('Packen: noch {0} {1} offen', [open, open === 1 ? 'Sache' : 'Sachen']), to: `/trip/${trip.id}/packliste` }]
}
