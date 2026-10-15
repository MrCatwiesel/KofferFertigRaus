import { db, newId, now } from '@/core/db'
import { tripRepository } from '@/modules/trip/public'
import { checkinId, itemsOf } from './logic'
import type { ChecklistItem, ChecklistKind } from './types'

/** Datenzugriff des Moduls „Abreise-Checklisten“. */
export const checklistRepository = {
  listByTrip(tripId: string): Promise<ChecklistItem[]> {
    return db.checklistItems.where('tripId').equals(tripId).toArray()
  },

  /** Punkte ans Ende einer Liste anhängen */
  async add(tripId: string, list: ChecklistKind, ref: string, texts: string[], done = false): Promise<void> {
    if (!texts.length) return
    const existing = itemsOf(await this.listByTrip(tripId), list, ref)
    let pos = existing.reduce((m, i) => Math.max(m, i.position), -1)
    const ts = now()
    await db.checklistItems.bulkAdd(texts.map((text) => ({ id: newId(), tripId, list, ref, text, done, position: ++pos, createdAt: ts, updatedAt: ts })))
  },

  async setDone(id: string, done: boolean): Promise<void> {
    await db.checklistItems.update(id, { done, updatedAt: now() })
  },

  /** Online-Check-in eines Flugs abhaken (feste ID je Reise und Etappe, damit Geräte nichts doppelt anlegen) */
  async setCheckin(tripId: string, legId: string, done: boolean, text: string): Promise<void> {
    const id = checkinId(tripId, legId)
    const ts = now()
    const old = await db.checklistItems.get(id)
    await db.checklistItems.put({ id, tripId, list: 'checkin', ref: legId, text, done, position: 0, createdAt: old?.createdAt ?? ts, updatedAt: ts })
  },

  async setAll(ids: string[], done: boolean): Promise<void> {
    const ts = now()
    await db.transaction('rw', db.checklistItems, async () => {
      for (const id of ids) await db.checklistItems.update(id, { done, updatedAt: ts })
    })
  },

  async remove(id: string): Promise<void> {
    await db.checklistItems.delete(id)
  },

  async removeByTrip(tripId: string): Promise<void> {
    await db.checklistItems.where('tripId').equals(tripId).delete()
  },

  /** Liste „zu Hause“ der zuletzt begonnenen anderen Reise, die eine hat – zum Übernehmen */
  async previousHomeList(tripId: string): Promise<{ title: string; texts: string[] } | null> {
    for (const trip of await tripRepository.listAll()) {
      if (trip.id === tripId) continue
      const items = itemsOf(await this.listByTrip(trip.id), 'zuhause')
      if (items.length) return { title: trip.title, texts: items.map((i) => i.text) }
    }
    return null
  }
}
