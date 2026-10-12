import { db, newId, now } from '@/core/db'
import { computeStats, dateOf, roundPoints, simplifyTo } from './logic'
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
  }
}
