import { db, newId, now } from '@/core/db'
import type { EmergencyContact, EmergencyContactDraft, TravelDocument, TravelDocumentDraft } from './types'
import { t } from '@/core/i18n'

export const documentRepository = {
  listByTrip(tripId: string): Promise<TravelDocument[]> {
    return db.documents.where('tripId').equals(tripId).toArray()
  },
  get(id: string): Promise<TravelDocument | undefined> {
    return db.documents.get(id)
  },
  async create(tripId: string, draft: TravelDocumentDraft): Promise<string> {
    const ts = now()
    const item: TravelDocument = { ...draft, id: newId(), tripId, createdAt: ts, updatedAt: ts }
    await db.documents.add(item)
    return item.id
  },
  async createMany(tripId: string, drafts: TravelDocumentDraft[]): Promise<void> {
    const ts = now()
    await db.documents.bulkAdd(drafts.map((d) => ({ ...d, id: newId(), tripId, createdAt: ts, updatedAt: ts })))
  },
  async update(id: string, draft: TravelDocumentDraft): Promise<void> {
    await db.documents.update(id, { ...draft, updatedAt: now() })
  },
  async setPacked(id: string, packed: boolean): Promise<void> {
    await db.documents.update(id, { packed, updatedAt: now() })
  },
  async remove(id: string): Promise<void> {
    await db.documents.delete(id)
  },
  async removeByTrip(tripId: string): Promise<void> {
    await db.documents.where('tripId').equals(tripId).delete()
  },
  /**
   * Automatisch erzeugten Eintrag anlegen oder aktualisieren (erkannt an `source`).
   * Titel, Art und Notizen werden aktualisiert; was der Nutzer abhakt (Status, eingepackt) bleibt.
   */
  async upsertBySource(tripId: string, source: string, d: Pick<TravelDocument, 'type' | 'title' | 'notes' | 'status'>): Promise<'neu' | 'aktualisiert' | 'gleich'> {
    const existing = (await db.documents.where('tripId').equals(tripId).toArray()).find((x) => x.source === source)
    if (existing) {
      if (existing.title === d.title && existing.notes === d.notes && existing.type === d.type) return 'gleich'
      await db.documents.update(existing.id, { type: d.type, title: d.title, notes: d.notes, updatedAt: now() })
      return 'aktualisiert'
    }
    const ts = now()
    await db.documents.add({ ...d, person: '', number: '', validUntil: '', hasCopy: false, packed: false, source, id: newId(), tripId, createdAt: ts, updatedAt: ts })
    return 'neu'
  },
  /** Automatisch erzeugte Einträge mit diesem Präfix entfernen (z. B. Land aus der Reise genommen) */
  async removeBySourcePrefix(tripId: string, prefix: string): Promise<void> {
    const ids = (await db.documents.where('tripId').equals(tripId).toArray()).filter((x) => x.source?.startsWith(prefix)).map((x) => x.id)
    await db.documents.bulkDelete(ids)
  }
}

export const contactRepository = {
  listByTrip(tripId: string): Promise<EmergencyContact[]> {
    return db.emergencyContacts.where('tripId').equals(tripId).toArray()
  },
  get(id: string): Promise<EmergencyContact | undefined> {
    return db.emergencyContacts.get(id)
  },
  async create(tripId: string, draft: EmergencyContactDraft): Promise<string> {
    const ts = now()
    const item: EmergencyContact = { ...draft, id: newId(), tripId, createdAt: ts, updatedAt: ts }
    await db.emergencyContacts.add(item)
    return item.id
  },
  async update(id: string, draft: EmergencyContactDraft): Promise<void> {
    await db.emergencyContacts.update(id, { ...draft, updatedAt: now() })
  },
  async remove(id: string): Promise<void> {
    await db.emergencyContacts.delete(id)
  },
  async removeByTrip(tripId: string): Promise<void> {
    await db.emergencyContacts.where('tripId').equals(tripId).delete()
  },
  /**
   * Automatisch erzeugte Nummern abgleichen: alle mit `prefix` werden genau zu `items`
   * (anlegen, aktualisieren, nicht mehr genannte entfernen).
   */
  async syncBySource(tripId: string, prefix: string, items: (EmergencyContactDraft & { source: string })[]): Promise<void> {
    const ts = now()
    const existing = (await db.emergencyContacts.where('tripId').equals(tripId).toArray()).filter((c) => c.source?.startsWith(prefix))
    const wanted = new Set(items.map((i) => i.source))
    await db.emergencyContacts.bulkDelete(existing.filter((c) => !wanted.has(c.source!)).map((c) => c.id))
    for (const i of items) {
      const old = existing.find((c) => c.source === i.source)
      if (!old) await db.emergencyContacts.add({ ...i, id: newId(), tripId, createdAt: ts, updatedAt: ts })
      else if (old.label !== i.label || old.phone !== i.phone || old.notes !== i.notes)
        await db.emergencyContacts.update(old.id, { label: i.label, phone: i.phone, notes: i.notes, updatedAt: ts })
    }
  },
  async removeBySourcePrefix(tripId: string, prefix: string): Promise<void> {
    const ids = (await db.emergencyContacts.where('tripId').equals(tripId).toArray()).filter((c) => c.source?.startsWith(prefix)).map((c) => c.id)
    await db.emergencyContacts.bulkDelete(ids)
  }
}
