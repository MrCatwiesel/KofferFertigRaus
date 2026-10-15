import type { SampleTrip } from '@/core/sample'
import { activityRepository } from './repository'
import { emptyActivityDraft } from './logic'
import type { ActivityDraft } from './types'

/** Beispielreise: erledigt, heute geplant, später geplant und offene Ideen – mit Ort für die Karte */
export async function activitySample(s: SampleTrip): Promise<void> {
  const items: (Partial<ActivityDraft> & { title: string; at: [number, number] })[] = [
    { title: 'Mit der Seilbahn auf den Monte Baldo', category: 'natur', setting: 'aussen', priority: 1, place: 'Malcesine', durationHours: 5, pricePerPerson: 26, status: 'erledigt', plannedDate: s.day(1), at: [45.7637, 10.8098] },
    { title: 'Wasserfall Cascata del Varone', category: 'natur', setting: 'gemischt', priority: 2, place: 'Tenno', durationHours: 1.5, pricePerPerson: 8, openingHours: 'Mo–So 9–18', status: 'geplant', plannedDate: s.day(2), at: [45.9036, 10.8279] },
    { title: 'Radtour auf der Ponale-Straße', category: 'aktiv', setting: 'aussen', priority: 1, place: 'Riva del Garda', durationHours: 3, status: 'geplant', plannedDate: s.day(4), notes: 'Räder beim Verleih am Hafen reservieren.', bookingRequired: true, at: [45.8795, 10.8335] },
    { title: 'Museum in der Rocca di Riva', category: 'kultur', setting: 'innen', priority: 2, place: 'Riva del Garda', durationHours: 2, pricePerPerson: 5, openingHours: 'Di–So 10–18', at: [45.8853, 10.8424] },
    { title: 'Burg Arco', category: 'kultur', setting: 'aussen', priority: 2, place: 'Arco', durationHours: 2, pricePerPerson: 4, at: [45.9227, 10.8858] },
    { title: 'Baden am Lago di Tenno', category: 'entspannung', setting: 'aussen', priority: 3, place: 'Tenno', durationHours: 3, at: [45.9206, 10.832] },
    { title: 'Eis am Hafen', category: 'essen', setting: 'aussen', priority: 3, place: 'Riva del Garda', durationHours: 0.5, at: [45.8857, 10.841] }
  ]
  for (const { at, ...d } of items) {
    const id = await activityRepository.create(s.tripId, { ...emptyActivityDraft(s.currency), ...d })
    s.locations.push({ kind: 'activity', refId: id, lat: at[0], lon: at[1], label: d.place ?? '' })
  }
}
