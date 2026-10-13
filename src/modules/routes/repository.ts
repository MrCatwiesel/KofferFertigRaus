import { db, newId, now } from '@/core/db'
import { computeStats, dateOf, interpolateElevations, lacksElevation, roundPoints, simplifyTo } from './logic'
import { fetchElevations } from './planning/api'
import { matchesGarbled } from './parse/text'
import { parseRouteFile } from './parse'
import type { ParsedRoute, Route, RouteDraft, RouteFormat } from './types'
import { ROUTE_COLORS } from './types'

/** Höchstzahl gespeicherter Punkte (Karte, Profil) und für Vorschau (Webseite, Lese-Link). */
const MAX_POINTS = 2000
const MAX_PREVIEW = 400

/** Aus einer gelesenen Datei einen Datensatz bauen (Kennzahlen aus allen Punkten, gespeichert vereinfacht). */
export function buildRoute(
  tripId: string,
  parsed: ParsedRoute,
  file: { format: RouteFormat; filename: string; original: Blob | null },
  index: number,
  trip?: { startDate: string; endDate: string }
): Route {
  const ts = now()
  const stats = computeStats(parsed.points)
  const date = dateOf(parsed.points)
  const inTrip = !!trip && !!date && date >= trip.startDate && date <= trip.endDate
  return {
    id: newId(),
    tripId,
    name: parsed.name,
    kind: parsed.kind,
    color: ROUTE_COLORS[index % ROUTE_COLORS.length],
    date: inTrip ? date : '',
    notes: '',
    showInShare: parsed.kind === 'track',
    points: roundPoints(simplifyTo(parsed.points, MAX_POINTS)),
    preview: roundPoints(simplifyTo(parsed.points, MAX_PREVIEW)).map(([la, lo, e]) => [la, lo, e]),
    stats,
    format: file.format,
    filename: file.filename,
    original: file.original,
    createdAt: ts,
    updatedAt: ts
  }
}

export const routeRepository = {
  listByTrip(tripId: string): Promise<Route[]> {
    return db.routes.where('tripId').equals(tripId).toArray()
  },
  get(id: string): Promise<Route | undefined> {
    return db.routes.get(id)
  },
  async addMany(routes: Route[]): Promise<void> {
    await db.routes.bulkAdd(routes)
  },
  async update(id: string, draft: Partial<RouteDraft>): Promise<void> {
    await db.routes.update(id, { ...draft, updatedAt: now() })
  },
  async remove(id: string): Promise<void> {
    await db.routes.delete(id)
  },
  async removeByTrip(tripId: string): Promise<void> {
    await db.routes.where('tripId').equals(tripId).delete()
  },
  count(tripId: string): Promise<number> {
    return db.routes.where('tripId').equals(tripId).count()
  },

  /**
   * Fehlende Höhen aus dem Geländemodell (Open-Meteo) ergänzen – für Dateien ohne Höhenangaben.
   * Fragt höchstens 300 Stützstellen ab und rechnet dazwischen. Gibt zurück, ob etwas ergänzt wurde.
   */
  async fillElevations(id: string): Promise<boolean> {
    const r = await db.routes.get(id)
    if (!r || !lacksElevation(r.points)) return false
    const step = Math.max(1, Math.ceil(r.points.length / 300))
    const idx = r.points.map((_, i) => i).filter((i) => i % step === 0 || i === r.points.length - 1)
    const ele = await fetchElevations(idx.map((i) => [r.points[i][0], r.points[i][1]]))
    if (!ele.some((e) => e !== null)) return false
    const points = interpolateElevations(r.points, idx.map((index, k) => ({ index, ele: ele[k] })), true)
    const s = computeStats(points)
    await db.routes.update(id, {
      points,
      preview: roundPoints(simplifyTo(points, MAX_PREVIEW)).map(([la, lo, e]) => [la, lo, e]),
      // Strecke und Zeiten bleiben (aus der vollständigen Datei berechnet), nur die Höhen kommen dazu
      stats: { ...r.stats, ascent: s.ascent, descent: s.descent, minEle: s.minEle, maxEle: s.maxEle },
      elevationSource: 'gelaende',
      updatedAt: now()
    })
    return true
  },

  /** Alle Routen ohne Höhen nachträglich ergänzen (höchstens 10 je Start, um den Dienst zu schonen) */
  async fillAllMissingElevations(): Promise<number> {
    const flat = (await db.routes.toArray()).filter((r) => lacksElevation(r.points)).slice(0, 10)
    let n = 0
    for (const r of flat) if (await this.fillElevations(r.id)) n++
    return n
  },

  /**
   * Namen reparieren, die vor Version 1.17 mit falscher Zeichenkodierung eingelesen wurden („Gro�glockner“):
   * Originaldatei neu lesen und den passenden, richtig geschriebenen Namen übernehmen.
   */
  async repairNames(): Promise<number> {
    let fixed = 0
    const broken = (await db.routes.toArray()).filter((r) => r.name.includes('\uFFFD') && r.original instanceof Blob && r.filename)
    for (const r of broken) {
      try {
        const bytes = new Uint8Array(await r.original!.arrayBuffer())
        const { routes } = await parseRouteFile(r.filename, bytes)
        const name = routes.map((p) => p.name).find((n) => matchesGarbled(r.name, n))
        if (name) {
          await db.routes.update(r.id, { name, updatedAt: now() })
          fixed++
        }
      } catch {
        /* Datei nicht lesbar – Name bleibt */
      }
    }
    return fixed
  }
}
