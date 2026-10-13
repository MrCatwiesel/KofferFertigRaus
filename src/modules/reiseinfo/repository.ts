import { db, now } from '@/core/db'
import type { CountryInfo } from './types'

export const countryInfoRepository = {
  listByTrip(tripId: string): Promise<CountryInfo[]> {
    return db.countryInfos.where('tripId').equals(tripId).toArray()
  },
  get(id: string): Promise<CountryInfo | undefined> {
    return db.countryInfos.get(id)
  },
  async put(info: CountryInfo): Promise<void> {
    await db.countryInfos.put(info)
  },
  async markSeen(id: string): Promise<void> {
    await db.countryInfos.update(id, { unseenChange: false, updatedAt: now() })
  },
  async remove(id: string): Promise<void> {
    await db.countryInfos.delete(id)
  },
  async removeByTrip(tripId: string): Promise<void> {
    await db.countryInfos.where('tripId').equals(tripId).delete()
  }
}
