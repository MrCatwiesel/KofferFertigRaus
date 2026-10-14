import { db, newId, now } from '@/core/db'
import type { Accommodation, AccommodationDraft } from './types'
import { t } from '@/core/i18n'

export const accommodationRepository = {
  listByTrip(tripId: string): Promise<Accommodation[]> {
    return db.accommodations.where('tripId').equals(tripId).toArray()
  },

  get(id: string): Promise<Accommodation | undefined> {
    return db.accommodations.get(id)
  },

  async create(tripId: string, draft: AccommodationDraft): Promise<string> {
    const ts = now()
    const item: Accommodation = { ...draft, id: newId(), tripId, createdAt: ts, updatedAt: ts }
    await db.accommodations.add(item)
    return item.id
  },

  async update(id: string, draft: AccommodationDraft): Promise<void> {
    await db.accommodations.update(id, { ...draft, updatedAt: now() })
  },

  async remove(id: string): Promise<void> {
    await db.accommodations.delete(id)
  },

  async removeByTrip(tripId: string): Promise<void> {
    await db.accommodations.where('tripId').equals(tripId).delete()
  }
}
