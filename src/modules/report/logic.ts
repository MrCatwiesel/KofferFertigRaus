/**
 * Reisebericht: Tagebuch, Fotos, Touren und Zahlen einer Reise für den Druck (PDF) zusammenstellen.
 * Reine Logik (testbar) – die Ansicht setzt daraus die Seiten.
 */
export interface ReportOptions {
  /** bericht = kompakt mit Text im Vordergrund; fotobuch = große Fotos, jeder Tag auf neuer Seite */
  layout: 'bericht' | 'fotobuch'
  /** Nur Tagebucheinträge, die als Höhepunkt markiert sind */
  onlyHighlights: boolean
  /** Fotos je Eintrag: alle, höchstens 4, keine */
  photos: 'alle' | 'vier' | 'keine'
  routes: boolean
  stats: boolean
  expenses: boolean
  stays: boolean
}

export const DEFAULT_OPTIONS: ReportOptions = { layout: 'bericht', onlyHighlights: false, photos: 'alle', routes: true, stats: true, expenses: false, stays: true }

export interface InEntry {
  id: string
  date: string
  title: string
  text: string
  mood: number
  location: string
  highlight: boolean
  photoIds: string[]
  createdAt: string
}

export interface InPhoto {
  id: string
  entryId: string
  takenAt: string
  caption: string
  width: number
  height: number
}

export interface InRoute {
  id: string
  name: string
  date: string
  color: string
  showInShare: boolean
  stats: { distance: number; ascent: number; descent: number; duration: number | null }
}

export interface ReportDay<P, R = InRoute> {
  date: string
  /** Tag der Reise (1 …) oder 0 außerhalb */
  dayNo: number
  entries: { id: string; title: string; text: string; mood: number; location: string; photos: P[] }[]
  routes: R[]
}

export interface ReportStats {
  days: number
  entries: number
  photos: number
  routes: number
  distance: number
  ascent: number
}

const dayNumber = (date: string, start: string) => {
  const d = Math.round((Date.parse(date) - Date.parse(start)) / 86400_000) + 1
  return Number.isFinite(d) && d >= 1 ? d : 0
}

/** Tage mit Einträgen und Touren, chronologisch; Fotos je Eintrag in der Tagebuch-Reihenfolge */
export function buildDays<P extends InPhoto, R extends InRoute>(
  trip: { startDate: string; endDate: string },
  entries: InEntry[],
  photos: P[],
  routes: R[],
  o: ReportOptions
): { days: ReportDay<P, R>[]; otherRoutes: R[] } {
  const chosen = entries.filter((e) => !o.onlyHighlights || e.highlight).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  const byEntry = new Map<string, P[]>()
  for (const p of photos) byEntry.set(p.entryId, [...(byEntry.get(p.entryId) ?? []), p])
  const usedRoutes = o.routes ? routes : []
  const dates = [...new Set([...chosen.map((e) => e.date), ...usedRoutes.filter((r) => r.date).map((r) => r.date)])].sort()
  const days = dates.map((date) => ({
    date,
    dayNo: dayNumber(date, trip.startDate),
    entries: chosen
      .filter((e) => e.date === date)
      .map((e) => {
        const pos = new Map(e.photoIds.map((id, i) => [id, i]))
        const ps = [...(byEntry.get(e.id) ?? [])].sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9) || a.takenAt.localeCompare(b.takenAt))
        const limit = o.photos === 'keine' ? 0 : o.photos === 'vier' ? 4 : ps.length
        return { id: e.id, title: e.title, text: e.text, mood: e.mood, location: e.location, photos: ps.slice(0, limit) }
      }),
    routes: usedRoutes.filter((r) => r.date === date)
  }))
  return { days, otherRoutes: usedRoutes.filter((r) => !r.date) }
}

export function reportStats(trip: { startDate: string; endDate: string }, entries: InEntry[], photoCount: number, routes: InRoute[]): ReportStats {
  return {
    days: Math.max(1, Math.round((Date.parse(trip.endDate) - Date.parse(trip.startDate)) / 86400_000) + 1),
    entries: entries.length,
    photos: photoCount,
    routes: routes.length,
    distance: routes.reduce((s, r) => s + (r.stats.distance || 0), 0),
    ascent: routes.reduce((s, r) => s + (r.stats.ascent || 0), 0)
  }
}

/** Foto für die Titelseite: eigenes Titelbild der Reise, sonst das erste Querformat-Foto eines Höhepunkts */
export function pickCover<P extends InPhoto>(entries: InEntry[], photos: P[]): P | null {
  const hl = new Set(entries.filter((e) => e.highlight).map((e) => e.id))
  const landscape = (p: P) => p.width >= p.height
  return photos.find((p) => hl.has(p.entryId) && landscape(p)) ?? photos.find(landscape) ?? photos[0] ?? null
}

/** Fotoraster: Anzahl Spalten je nach Fotozahl und Layout */
export function photoColumns(n: number, layout: ReportOptions['layout']): number {
  if (layout === 'fotobuch') return n === 1 ? 1 : 2
  return n === 1 ? 1 : n === 2 || n === 4 ? 2 : 3
}
