import { db, now } from '@/core/db'
import { tripRepository } from '@/modules/trip/public'
import { hasContent, mergeDraft, profileId } from './logic'
import type { HealthDraft, HealthProfile } from './types'

/** Datenzugriff „Gesundheit & Notfall“ – ein Eintrag je Reise und Person */
export const healthRepository = {
  listByTrip(tripId: string): Promise<HealthProfile[]> {
    return db.healthProfiles.where('tripId').equals(tripId).toArray()
  },

  get(tripId: string, person: string): Promise<HealthProfile | undefined> {
    return db.healthProfiles.get(profileId(tripId, person))
  },

  async save(tripId: string, person: string, draft: HealthDraft): Promise<void> {
    const id = profileId(tripId, person)
    const ts = now()
    const old = await db.healthProfiles.get(id)
    // Kopie: reaktive Objekte lassen sich nicht in IndexedDB speichern
    const data = JSON.parse(JSON.stringify(draft)) as HealthDraft
    await db.healthProfiles.put({ ...data, id, tripId, person, createdAt: old?.createdAt ?? ts, updatedAt: ts })
  },

  /** Übersetzung einer eigenen Allergie nachtragen (z. B. direkt im Sprachführer) */
  async setTranslation(tripId: string, person: string, customId: string, lang: string, value: string): Promise<void> {
    const p = await this.get(tripId, person)
    if (!p) return
    const custom = p.custom.map((c) => (c.id === customId ? { ...c, tr: { ...c.tr, [lang]: value } } : c))
    await db.healthProfiles.update(p.id, { custom, updatedAt: now() })
  },

  /** Angaben ergänzen (Übernahme aus einer anderen Reise oder von diesem Gerät) */
  async merge(tripId: string, person: string, add: Partial<HealthDraft>, empty: HealthDraft): Promise<void> {
    const old = await this.get(tripId, person)
    const base: HealthDraft = old
      ? { allergens: old.allergens, custom: old.custom, conditions: old.conditions, bloodType: old.bloodType, otherConditions: old.otherConditions, notes: old.notes, sharedWith: old.sharedWith }
      : empty
    await this.save(tripId, person, mergeDraft(base, add))
  },

  async remove(tripId: string, person: string): Promise<void> {
    await db.healthProfiles.delete(profileId(tripId, person))
  },

  async removeByTrip(tripId: string): Promise<void> {
    await db.healthProfiles.where('tripId').equals(tripId).delete()
  },

  /** Zuletzt begonnene andere Reise mit Angaben zu einer dieser Personen – zum Übernehmen */
  async previousTrip(tripId: string, persons: string[]): Promise<{ title: string; profiles: HealthProfile[] } | null> {
    const trips = (await tripRepository.listAll()).filter((t) => t.id !== tripId).sort((a, b) => b.startDate.localeCompare(a.startDate))
    for (const trip of trips) {
      const profiles = (await this.listByTrip(trip.id)).filter((p) => persons.includes(p.person) && hasContent(p))
      if (profiles.length) return { title: trip.title, profiles }
    }
    return null
  }
}
