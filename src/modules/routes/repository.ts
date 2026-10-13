import { db, newId, now } from '@/core/db'
import { getMeta, setMeta } from '@/core/meta'
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

  /**
   * Pflege beim Start: Namen mit falscher Zeichenkodierung aus Versionen vor 1.17 reparieren („Gro�glockner“)
   * und fehlende Höhen ergänzen (Dateien ohne Höhenangaben; höchstens 10 Abfragen je Start, um den Dienst zu schonen).
   *
   * Jede Route wird nur einmal angesehen – welche schon geprüft sind, steht in `routes.geprueft` (nur auf diesem Gerät).
   * Vorher wurden bei jedem Start alle Routen zweimal komplett geladen; mit einigen hundert Routen blockierte das
   * die Oberfläche spürbar.
   */
  async maintain(online: boolean): Promise<{ names: number; elevations: number }> {
    const keys = (await db.routes.toCollection().primaryKeys()) as string[]
    const checked = new Set(await getMeta<string[]>(CHECKED_KEY, []))
    const todo = keys.filter((k) => !checked.has(k))
    const result = { names: 0, elevations: 0 }
    let asked = 0
    for (let i = 0; i < todo.length; i += 20) {
      const rows = (await db.routes.bulkGet(todo.slice(i, i + 20))).filter((r): r is Route => !!r)
      for (const r of rows) {
        if (await repairName(r)) result.names++
        if (lacksElevation(r.points)) {
          if (!online || asked >= 10) continue // beim nächsten Start noch einmal
          asked++
          if (!(await this.fillElevations(r.id).catch(() => false))) continue
          result.elevations++
        }
        checked.add(r.id)
      }
      await new Promise((res) => setTimeout(res, 0)) // Oberfläche zwischendurch zum Zug kommen lassen
    }
    const alive = new Set(keys)
    if (todo.length || checked.size !== keys.length) await setMeta(CHECKED_KEY, [...checked].filter((k) => alive.has(k)))
    return result
  }
}

/** Gemerkt: Routen, die schon auf Namen und Höhen geprüft sind */
const CHECKED_KEY = 'routes.geprueft'

/** Einen kaputten Namen aus der Originaldatei neu lesen */
async function repairName(r: Route): Promise<boolean> {
  if (!r.name.includes('\uFFFD') || !(r.original instanceof Blob) || !r.filename) return false
  try {
    const bytes = new Uint8Array(await r.original.arrayBuffer())
    const { routes } = await parseRouteFile(r.filename, bytes)
    const name = routes.map((p) => p.name).find((n) => matchesGarbled(r.name, n))
    if (!name) return false
    await db.routes.update(r.id, { name, updatedAt: now() })
    r.name = name
    return true
  } catch {
    return false // Datei nicht lesbar – Name bleibt
  }
}
