import { shiftDate, type Reminder, type ReminderTrip } from '@/core/reminders'
import type { PackingItem } from './types'

/** Zwei Tage vor Abreise: Packliste, solange noch etwas fehlt */
export function packingReminders(items: PackingItem[], trip: ReminderTrip, today: string): Reminder[] {
  const open = items.filter((i) => !i.packed).length
  if (!items.length || !open || trip.startDate < today) return []
  return [{ id: `pack:${trip.id}`, tripId: trip.id, date: shiftDate(trip.startDate, -2), kind: 'pruefen', title: `Packen: noch ${open} ${open === 1 ? 'Sache' : 'Sachen'} offen`, to: `/trip/${trip.id}/packliste` }]
}
