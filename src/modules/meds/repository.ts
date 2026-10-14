import { db, newId, now } from '@/core/db'
import type { Medication, MedicationDraft, Vaccination, VaccinationDraft } from './types'
import { t } from '@/core/i18n'

export const medicationRepository = {
  listByTrip(tripId: string): Promise<Medication[]> {
    return db.medications.where('tripId').equals(tripId).toArray()
  },
  get(id: string): Promise<Medication | undefined> {
    return db.medications.get(id)
  },
  async create(tripId: string, draft: MedicationDraft): Promise<string> {
    const ts = now()
    const item: Medication = { ...draft, id: newId(), tripId, createdAt: ts, updatedAt: ts }
    await db.medications.add(item)
    return item.id
  },
  async createMany(tripId: string, drafts: MedicationDraft[]): Promise<void> {
    const ts = now()
    await db.medications.bulkAdd(drafts.map((d) => ({ ...d, id: newId(), tripId, createdAt: ts, updatedAt: ts })))
  },
  async update(id: string, draft: MedicationDraft): Promise<void> {
    await db.medications.update(id, { ...draft, updatedAt: now() })
  },
  async setPacked(id: string, packed: boolean): Promise<void> {
    await db.medications.update(id, { packed, updatedAt: now() })
  },
  async remove(id: string): Promise<void> {
    await db.medications.delete(id)
  },
  async removeByTrip(tripId: string): Promise<void> {
    await db.medications.where('tripId').equals(tripId).delete()
  }
}

export const vaccinationRepository = {
  async createMany(tripId: string, drafts: VaccinationDraft[]): Promise<void> {
    const ts = now()
    await db.vaccinations.bulkAdd(drafts.map((d) => ({ ...d, id: newId(), tripId, createdAt: ts, updatedAt: ts })))
  },
  listByTrip(tripId: string): Promise<Vaccination[]> {
    return db.vaccinations.where('tripId').equals(tripId).toArray()
  },
  get(id: string): Promise<Vaccination | undefined> {
    return db.vaccinations.get(id)
  },
  async create(tripId: string, draft: VaccinationDraft): Promise<string> {
    const ts = now()
    const item: Vaccination = { ...draft, id: newId(), tripId, createdAt: ts, updatedAt: ts }
    await db.vaccinations.add(item)
    return item.id
  },
  async update(id: string, draft: VaccinationDraft): Promise<void> {
    await db.vaccinations.update(id, { ...draft, updatedAt: now() })
  },
  async remove(id: string): Promise<void> {
    await db.vaccinations.delete(id)
  },
  async removeByTrip(tripId: string): Promise<void> {
    await db.vaccinations.where('tripId').equals(tripId).delete()
  }
}
