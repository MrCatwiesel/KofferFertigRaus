import { shiftDate, type Reminder, type ReminderTrip } from '@/core/reminders'
import type { PackingItem } from './types'
import { tn } from '@/i18n'

/** Zwei Tage vor Abreise: Packliste, solange noch etwas fehlt */
export function packingReminders(items: PackingItem[], trip: ReminderTrip, today: string): Reminder[] {
  const open = items.filter((i) => !i.packed).length
  if (!items.length || !open || trip.startDate < today) return []
  return [{ id: `pack:${trip.id}`, tripId: trip.id, date: shiftDate(trip.startDate, -2), kind: 'pruefen', title: tn(open, 'Packen: noch 1 Sache offen', 'Packen: noch {n} Sachen offen'), to: `/trip/${trip.id}/packliste` }]
}
