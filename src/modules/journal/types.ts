/** Ein Tagebucheintrag – meist einer pro Tag, mehrere sind möglich. */
export interface JournalEntry {
  id: string
  tripId: string
  /** ISO-Datum */
  date: string
  title: string
  text: string
  /** Stimmung 1–5, 0 = nicht angegeben */
  mood: number
  /** Ort, z. B. "Malcesine" */
  location: string
  /** Für die Reise-Webseite als Höhepunkt markiert */
  highlight: boolean
  /** Reihenfolge der Fotos (das erste ist das Titelbild) */
  photoIds: string[]
  createdAt: string
  updatedAt: string
}

export type JournalEntryDraft = Omit<JournalEntry, 'id' | 'tripId' | 'photoIds' | 'createdAt' | 'updatedAt'>

/** Ein Foto – verkleinert gespeichert, mit Vorschaubild. */
export interface Photo {
  id: string
  tripId: string
  entryId: string
  full: Blob
  thumb: Blob
  width: number
  height: number
  caption: string
  /** Aufnahmezeit (soweit bekannt, sonst Zeitpunkt des Hinzufügens) */
  takenAt: string
  createdAt: string
  /** Zuletzt geändert (z. B. Bildunterschrift) – wichtig für den Abgleich */
  updatedAt?: string
  /** Verweis auf eine Fotogalerie, z. B. "piwigo:123" (dort liegt das Original) */
  externalRef?: string
  /** Link zum Foto in der Galerie */
  externalUrl?: string
}

export const MOODS: { value: number; emoji: string; label: string }[] = [
  { value: 5, emoji: '😍', label: 'Traumhaft' },
  { value: 4, emoji: '😊', label: 'Schön' },
  { value: 3, emoji: '🙂', label: 'Okay' },
  { value: 2, emoji: '😕', label: 'Durchwachsen' },
  { value: 1, emoji: '😩', label: 'Anstrengend' }
]
