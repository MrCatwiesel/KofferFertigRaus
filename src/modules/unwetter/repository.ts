import { db } from '@/core/db'
import type { UnwetterStand } from './types'

/** Zuletzt geholte Warnungen je Reise (nur auf diesem Gerät, nicht abgeglichen). */
export const unwetterRepository = {
  get(tripId: string): Promise<UnwetterStand | undefined> {
    return db.unwetter.get(tripId)
  },
  async put(stand: UnwetterStand): Promise<void> {
    await db.unwetter.put(stand)
  },
  async remove(tripId: string): Promise<void> {
    await db.unwetter.delete(tripId)
  }
}
