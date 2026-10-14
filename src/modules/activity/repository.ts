import { db, newId, now } from '@/core/db'
import type { Activity, ActivityDraft, ActivityStatus } from './types'
import { t } from '@/core/i18n'

export const activityRepository = {
  listByTrip(tripId: string): Promise<Activity[]> {
    return db.activities.where('tripId').equals(tripId).toArray()
  },

  get(id: string): Promise<Activity | undefined> {
    return db.activities.get(id)
  },

  async create(tripId: string, draft: ActivityDraft): Promise<string> {
    const ts = now()
    const item: Activity = { ...draft, id: newId(), tripId, createdAt: ts, updatedAt: ts }
    await db.activities.add(item)
    return item.id
  },

  async update(id: string, draft: ActivityDraft): Promise<void> {
    await db.activities.update(id, { ...draft, updatedAt: now() })
  },

  /**
   * Auf einen Tag legen (oder mit leerem Datum wieder herausnehmen).
   * Ideen werden dabei zu "geplant", herausgenommene Pläne wieder zu "Idee"; Erledigtes bleibt erledigt.
   */
  async setPlannedDate(id: string, plannedDate: string): Promise<void> {
    const a = await db.activities.get(id)
    if (!a) return
    let status: ActivityStatus = a.status
    if (plannedDate && (a.status === 'idee' || a.status === 'verworfen')) status = 'geplant'
    if (!plannedDate && a.status === 'geplant') status = 'idee'
    await db.activities.update(id, { plannedDate, status, updatedAt: now() })
  },

  async setStatus(id: string, status: ActivityStatus): Promise<void> {
    await db.activities.update(id, { status, updatedAt: now() })
  },

  async remove(id: string): Promise<void> {
    await db.activities.delete(id)
  },

  async removeByTrip(tripId: string): Promise<void> {
    await db.activities.where('tripId').equals(tripId).delete()
  }
}
