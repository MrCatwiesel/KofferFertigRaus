import { db, newId, now } from '@/core/db'
import type { JournalEntry, JournalEntryDraft, Photo, VoiceNote } from './types'

export type NewPhoto = Omit<Photo, 'id' | 'tripId' | 'entryId' | 'createdAt'>
export type NewVoiceNote = Pick<VoiceNote, 'audio' | 'duration' | 'title' | 'recordedAt'>
/** Änderungen an den Sprachnotizen beim Speichern eines Eintrags */
export interface VoiceChanges {
  added: NewVoiceNote[]
  removed: string[]
  /** geänderte Titel vorhandener Notizen */
  titles: { id: string; title: string }[]
}

export const journalRepository = {
  listByTrip(tripId: string): Promise<JournalEntry[]> {
    return db.journalEntries.where('tripId').equals(tripId).toArray()
  },

  get(id: string): Promise<JournalEntry | undefined> {
    return db.journalEntries.get(id)
  },

  /**
   * Speichert einen Eintrag samt Fotos in einem Schritt:
   * neue Fotos anlegen, entfernte löschen, Reihenfolge übernehmen.
   * `order` enthält IDs vorhandener Fotos und Platzhalter "new:<index>" für neue.
   * Liefert die ID des Eintrags und die IDs der neuen Fotos (gleiche Reihenfolge wie `newPhotos`).
   */
  async save(
    tripId: string,
    id: string | undefined,
    draft: JournalEntryDraft,
    newPhotos: NewPhoto[],
    order: string[],
    removedPhotoIds: string[],
    voice: VoiceChanges = { added: [], removed: [], titles: [] }
  ): Promise<{ entryId: string; newPhotoIds: string[] }> {
    const ts = now()
    const entryId = id ?? newId()
    const created = newPhotos.map((p) => ({ ...p, id: newId(), tripId, entryId, createdAt: ts }))
    const photoIds = order
      .map((key) => (key.startsWith('new:') ? created[Number(key.slice(4))]?.id : key))
      .filter((x): x is string => !!x)

    const notes: VoiceNote[] = voice.added.map((v) => ({ ...v, id: newId(), tripId, entryId, createdAt: ts, updatedAt: ts }))

    await db.transaction('rw', db.journalEntries, db.photos, db.voiceNotes, async () => {
      if (created.length) await db.photos.bulkAdd(created)
      if (removedPhotoIds.length) await db.photos.bulkDelete(removedPhotoIds)
      if (notes.length) await db.voiceNotes.bulkAdd(notes)
      if (voice.removed.length) await db.voiceNotes.bulkDelete(voice.removed)
      for (const t of voice.titles) await db.voiceNotes.update(t.id, { title: t.title, updatedAt: ts })
      if (id) {
        await db.journalEntries.update(id, { ...draft, photoIds, updatedAt: ts })
      } else {
        await db.journalEntries.add({ ...draft, id: entryId, tripId, photoIds, createdAt: ts, updatedAt: ts })
      }
    })
    return { entryId, newPhotoIds: created.map((p) => p.id) }
  },

  async setHighlight(id: string, highlight: boolean): Promise<void> {
    await db.journalEntries.update(id, { highlight, updatedAt: now() })
  },

  async remove(id: string): Promise<void> {
    await db.transaction('rw', db.journalEntries, db.photos, db.voiceNotes, async () => {
      await db.photos.where('entryId').equals(id).delete()
      await db.voiceNotes.where('entryId').equals(id).delete()
      await db.journalEntries.delete(id)
    })
  },

  async removeByTrip(tripId: string): Promise<void> {
    await db.transaction('rw', db.journalEntries, db.photos, db.voiceNotes, async () => {
      await db.photos.where('tripId').equals(tripId).delete()
      await db.voiceNotes.where('tripId').equals(tripId).delete()
      await db.journalEntries.where('tripId').equals(tripId).delete()
    })
  }
}

export const photoRepository = {
  listByTrip(tripId: string): Promise<Photo[]> {
    return db.photos.where('tripId').equals(tripId).toArray()
  },
  listByEntry(entryId: string): Promise<Photo[]> {
    return db.photos.where('entryId').equals(entryId).toArray()
  },
  countByTrip(tripId: string): Promise<number> {
    return db.photos.where('tripId').equals(tripId).count()
  },
  async setCaption(id: string, caption: string): Promise<void> {
    await db.photos.update(id, { caption, updatedAt: now() })
  },
  get(id: string): Promise<Photo | undefined> {
    return db.photos.get(id)
  },
  /** Verknüpft ein Foto mit seinem Original in einer Galerie (z. B. nach dem Hochladen). */
  async setExternal(id: string, externalRef: string, externalUrl: string): Promise<void> {
    await db.photos.update(id, { externalRef, externalUrl, updatedAt: now() })
  },
  /** Aufnahmeort von Hand setzen bzw. entfernen (`null`) */
  async setPlace(id: string, pos: { lat: number; lon: number } | null): Promise<boolean> {
    const changes = pos
      ? { lat: Math.round(pos.lat * 1e6) / 1e6, lon: Math.round(pos.lon * 1e6) / 1e6, placeSource: 'karte' as const, updatedAt: now() }
      : { lat: undefined, lon: undefined, placeSource: undefined, updatedAt: now() }
    return (await db.photos.update(id, changes)) > 0
  }
}

export const voiceNoteRepository = {
  listByTrip(tripId: string): Promise<VoiceNote[]> {
    return db.voiceNotes.where('tripId').equals(tripId).toArray()
  },
  async listByEntry(entryId: string): Promise<VoiceNote[]> {
    return (await db.voiceNotes.where('entryId').equals(entryId).toArray()).sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
  }
}
