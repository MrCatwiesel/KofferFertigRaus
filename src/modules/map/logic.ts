import type { MapPlace, PlaceKind } from './types'

export function placeId(kind: PlaceKind, refId: string): string {
  return `${kind}:${refId}`
}

/** Suchtext: Adresse/Ort des Eintrags, ergänzt um das Reiseziel (falls nicht schon enthalten). */
export function buildQuery(where: string, name: string, destination: string): string {
  const base = (where || name).trim()
  if (!base) return destination
  const dest = destination.split(',')[0].trim()
  return dest && !base.toLowerCase().includes(dest.toLowerCase()) ? `${base}, ${dest}` : base
}

export interface MapItem {
  kind: PlaceKind
  refId: string
  title: string
  subtitle: string
  /** Text für die Adresssuche */
  where: string
  /** z. B. geplanter Tag der Unternehmung */
  date: string
  done: boolean
}

export interface Located extends MapItem {
  place: MapPlace
}

/** Teilt Einträge in "auf der Karte" und "noch nicht verortet". */
export function splitByLocation(items: MapItem[], places: MapPlace[]): { located: Located[]; missing: MapItem[] } {
  const byId = new Map(places.map((p) => [p.id, p]))
  const located: Located[] = []
  const missing: MapItem[] = []
  for (const it of items) {
    const p = byId.get(placeId(it.kind, it.refId))
    if (p) located.push({ ...it, place: p })
    else missing.push(it)
  }
  return { located, missing }
}

/** Kartenausschnitt, der alle Punkte zeigt: [[südwest], [nordost]] oder null. */
export function boundsOf(points: { lat: number; lon: number }[]): [[number, number], [number, number]] | null {
  if (!points.length) return null
  let s = 90
  let w = 180
  let n = -90
  let e = -180
  for (const p of points) {
    s = Math.min(s, p.lat)
    n = Math.max(n, p.lat)
    w = Math.min(w, p.lon)
    e = Math.max(e, p.lon)
  }
  return [
    [s, w],
    [n, e]
  ]
}

/** Links zur Navigation (öffnen Apple Karten bzw. Google Maps). */
export function navLinks(lat: number, lon: number, name: string) {
  const ll = `${lat.toFixed(6)},${lon.toFixed(6)}`
  return {
    apple: `https://maps.apple.com/?${new URLSearchParams({ daddr: ll, q: name })}`,
    google: `https://www.google.com/maps/dir/?${new URLSearchParams({ api: '1', destination: ll })}`
  }
}

/** Nächster Punkt einer Route zur angetippten Stelle. */
export function nearestOnRoute(points: [number, number][], lat: number, lon: number): [number, number] {
  const k = Math.cos((lat * Math.PI) / 180)
  let best = points[0]
  let bestD = Infinity
  for (const p of points) {
    const d = (p[0] - lat) ** 2 + ((p[1] - lon) * k) ** 2
    if (d < bestD) {
      bestD = d
      best = p
    }
  }
  return [best[0], best[1]]
}
