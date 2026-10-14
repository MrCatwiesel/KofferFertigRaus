import { db, newId, now } from '@/core/db'
import type { TravelDirection, TravelLeg, TravelLegDraft } from './types'
import { t } from '@/core/i18n'

export const travelRepository = {
  listByTrip(tripId: string): Promise<TravelLeg[]> {
    return db.travelLegs.where('tripId').equals(tripId).toArray()
  },

  get(id: string): Promise<TravelLeg | undefined> {
    return db.travelLegs.get(id)
  },

  /** Neue Etappe wird ans Ende ihrer Richtung angehängt. */
  async create(tripId: string, draft: TravelLegDraft): Promise<string> {
    const ts = now()
    const existing = await this.listByTrip(tripId)
    const position = existing.filter((l) => l.direction === draft.direction).reduce((m, l) => Math.max(m, l.position + 1), 0)
    const item: TravelLeg = { ...draft, id: newId(), tripId, position, createdAt: ts, updatedAt: ts }
    await db.travelLegs.add(item)
    return item.id
  },

  async createMany(tripId: string, drafts: TravelLegDraft[]): Promise<void> {
    await db.transaction('rw', db.travelLegs, async () => {
      for (const d of drafts) await this.create(tripId, d)
    })
  },

  /** Wechselt die Richtung, wird die Etappe ans Ende der neuen Richtung gestellt. */
  async update(id: string, draft: TravelLegDraft): Promise<void> {
    const old = await db.travelLegs.get(id)
    if (!old) return
    let position = old.position
    if (old.direction !== draft.direction) {
      const others = await this.listByTrip(old.tripId)
      position = others.filter((l) => l.direction === draft.direction).reduce((m, l) => Math.max(m, l.position + 1), 0)
    }
    await db.travelLegs.update(id, { ...draft, position, updatedAt: now() })
  },

  /** Verschiebt eine Etappe um eins nach oben (-1) oder unten (+1). */
  async move(tripId: string, direction: TravelDirection, id: string, delta: -1 | 1): Promise<void> {
    await db.transaction('rw', db.travelLegs, async () => {
      const legs = (await this.listByTrip(tripId)).filter((l) => l.direction === direction).sort((a, b) => a.position - b.position)
      const i = legs.findIndex((l) => l.id === id)
      const j = i + delta
      if (i < 0 || j < 0 || j >= legs.length) return
      ;[legs[i], legs[j]] = [legs[j], legs[i]]
      // Positionen neu durchnummerieren – repariert auch Lücken
      const ts = now()
      await Promise.all(legs.map((l, idx) => (l.position === idx ? undefined : db.travelLegs.update(l.id, { position: idx, updatedAt: ts }))))
    })
  },

  async remove(id: string): Promise<void> {
    await db.travelLegs.delete(id)
  },

  async removeByTrip(tripId: string): Promise<void> {
    await db.travelLegs.where('tripId').equals(tripId).delete()
  }
}
