import { addDays, diffDays, todayIso } from '../../core/dates'
import type { MapPhoto } from '../../core/registry'
import { MOODS, type JournalEntry, type JournalEntryDraft, type Photo } from './types'

export function emptyEntryDraft(date = ''): JournalEntryDraft {
  return { date, title: '', text: '', mood: 0, location: '', highlight: false }
}

/** Tag für einen neuen Eintrag: heute während der Reise, davor der erste, danach der letzte Tag. */
export function defaultEntryDate(start: string, end: string, today: Date = new Date()): string {
  const t = todayIso(today)
  if (t < start) return start
  if (t > end) return end
  return t
}

/** Ein Eintrag braucht ein Datum und irgendeinen Inhalt (Titel, Text oder Foto). */
export function validateEntry(d: JournalEntryDraft, photoCount: number): Partial<Record<keyof JournalEntryDraft | 'content', string>> {
  const e: Partial<Record<keyof JournalEntryDraft | 'content', string>> = {}
  if (!d.date) e.date = 'Bitte ein Datum wählen.'
  if (!d.title.trim() && !d.text.trim() && photoCount === 0) e.content = 'Schreib etwas oder füge ein Foto hinzu.'
  return e
}

/** Kurzfassung für die Übersicht, an Wortgrenze gekürzt. */
export function excerpt(text: string, max = 140): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[,.;:!?-]+$/, '')} …`
}

export function moodOf(value: number) {
  return MOODS.find((m) => m.value === value)
}

export interface DayGroup {
  date: string
  /** Tag n der Reise (1-basiert) oder null außerhalb */
  dayNumber: number | null
  entries: JournalEntry[]
}

/**
 * Alle Reisetage mit ihren Einträgen (auch leere Tage, damit man sieht, wo noch etwas fehlt).
 * Einträge außerhalb des Zeitraums kommen ebenfalls hinein.
 */
export function entriesByDay(start: string, end: string, entries: JournalEntry[]): DayGroup[] {
  const map = new Map<string, JournalEntry[]>()
  for (const e of entries) map.set(e.date, [...(map.get(e.date) ?? []), e])
  const days = new Set<string>()
  for (let d = start; d <= end; d = addDays(d, 1)) days.add(d)
  for (const d of map.keys()) days.add(d)
  return [...days]
    .sort()
    .map((date) => ({
      date,
      dayNumber: date >= start && date <= end ? diffDays(start, date) + 1 : null,
      entries: (map.get(date) ?? []).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    }))
}

export interface JournalStats {
  entries: number
  photos: number
  highlights: number
  /** Reisetage mit mindestens einem Eintrag */
  daysWritten: number
}

export function journalStats(entries: JournalEntry[], photoCount: number): JournalStats {
  return {
    entries: entries.length,
    photos: photoCount,
    highlights: entries.filter((e) => e.highlight).length,
    daysWritten: new Set(entries.map((e) => e.date)).size
  }
}

/** Fotos in der gespeicherten Reihenfolge; unbekannte hinten nach Zeit. */
export function orderPhotos<T extends Pick<Photo, 'id' | 'takenAt'>>(photoIds: string[], photos: T[]): T[] {
  const pos = new Map(photoIds.map((id, i) => [id, i]))
  return [...photos].sort((a, b) => {
    const pa = pos.get(a.id) ?? Number.MAX_SAFE_INTEGER
    const pb = pos.get(b.id) ?? Number.MAX_SAFE_INTEGER
    return pa - pb || a.takenAt.localeCompare(b.takenAt)
  })
}

/** Verschiebt ein Element um eine Position (gibt eine neue Liste zurück). */
export function moveItem<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const j = index + delta
  if (index < 0 || index >= list.length || j < 0 || j >= list.length) return list
  const copy = [...list]
  ;[copy[index], copy[j]] = [copy[j], copy[index]]
  return copy
}

/** Aufnahmezeit aus der Datei, soweit bekannt (Änderungsdatum), sonst jetzt. */
export function takenAtFromFile(file: { lastModified?: number }, now: Date = new Date()): string {
  return new Date(file.lastModified && file.lastModified > 0 ? file.lastModified : now.getTime()).toISOString()
}

// ——— Fotos auf der Karte ———

/** Punkt einer Tour: Breite, Länge, Höhe, Zeit (Sekunden seit 1970) */
type TimedPoint = readonly [number, number, number | null, number | null]

/**
 * Wo war man zu einer Zeit? Aus den aufgezeichneten Touren (mit Zeitstempeln) zwischen den beiden
 * nächsten Punkten gemittelt. Höchstens `slack` Sekunden vor dem Start bzw. nach dem Ende einer Tour
 * gilt noch deren Anfangs- bzw. Endpunkt (Foto am Parkplatz). Sonst `null`.
 */
export function positionAt(tracks: readonly (readonly TimedPoint[])[], when: number, slack = 900): [number, number] | null {
  let best: { pos: [number, number]; gap: number } | null = null
  for (const pts of tracks) {
    const timed = pts.filter((p) => p[3] !== null && Number.isFinite(p[3]))
    if (timed.length < 2) continue
    const t = (i: number) => timed[i][3] as number
    const first = t(0)
    const last = t(timed.length - 1)
    if (when < first - slack || when > last + slack) continue
    let pos: [number, number]
    let gap = 0
    if (when <= first) {
      pos = [timed[0][0], timed[0][1]]
      gap = first - when
    } else if (when >= last) {
      pos = [timed[timed.length - 1][0], timed[timed.length - 1][1]]
      gap = when - last
    } else {
      // binäre Suche: letzter Punkt vor `when`
      let lo = 0
      let hi = timed.length - 1
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1
        if (t(mid) <= when) lo = mid
        else hi = mid
      }
      const span = t(hi) - t(lo)
      const f = span > 0 ? (when - t(lo)) / span : 0
      pos = [timed[lo][0] + (timed[hi][0] - timed[lo][0]) * f, timed[lo][1] + (timed[hi][1] - timed[lo][1]) * f]
      // große Lücke in der Aufzeichnung (z. B. Gerät aus) → weniger sicher
      gap = Math.min(when - t(lo), t(hi) - when) > slack ? slack + 1 : 0
    }
    if (gap > slack) continue
    if (!best || gap < best.gap) best = { pos: [Math.round(pos[0] * 1e6) / 1e6, Math.round(pos[1] * 1e6) / 1e6], gap }
  }
  return best?.pos ?? null
}

/** Fotos einer Reise für die Karte: eigener Ort (GPS/Hand), sonst aus den Touren zur Aufnahmezeit, sonst ohne Ort */
export function photosForMap(
  tripId: string,
  photos: readonly Pick<Photo, 'id' | 'entryId' | 'caption' | 'takenAt' | 'thumb' | 'lat' | 'lon' | 'placeSource'>[],
  entries: readonly Pick<JournalEntry, 'id' | 'date'>[],
  tracks: readonly (readonly TimedPoint[])[]
): MapPhoto[] {
  const dates = new Map(entries.map((e) => [e.id, e.date]))
  const out: MapPhoto[] = []
  for (const p of photos) {
    const date = dates.get(p.entryId) ?? p.takenAt.slice(0, 10)
    const base = { id: p.id, date, caption: p.caption, takenAt: p.takenAt, thumb: p.thumb, to: `/trip/${tripId}/tagebuch/${p.entryId}` }
    if (typeof p.lat === 'number' && typeof p.lon === 'number') {
      out.push({ ...base, lat: p.lat, lon: p.lon, source: p.placeSource === 'karte' ? 'karte' : 'exif' })
      continue
    }
    const when = Date.parse(p.takenAt) / 1000
    const pos = Number.isFinite(when) ? positionAt(tracks, when) : null
    out.push(pos ? { ...base, lat: pos[0], lon: pos[1], source: 'tour' } : { ...base, lat: null, lon: null, source: 'keiner' })
  }
  return out
}
