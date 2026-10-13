/**
 * Reisestatistik / Jahresrückblick – reine Rechnung (testbar).
 * Gezählt werden Reisen, die schon begonnen haben; geplante werden getrennt genannt.
 */
export interface TripIn {
  id: string
  title: string
  destination: string
  startDate: string
  endDate: string
  countries?: string[]
}

export interface TripExtra {
  routes: { name: string; distance: number; ascent: number }[]
  photos: number
  entries: number
  nights: number
  /** Ausgaben je Währung */
  spent: Record<string, number>
  /** Ort für die Karte (Unterkunft, sonst Startpunkt einer Tour) */
  location: [number, number] | null
}

export interface TripRow extends TripIn {
  days: number
  distance: number
  ascent: number
  photos: number
  entries: number
}

export interface Summary {
  trips: number
  planned: number
  days: number
  countries: string[]
  distance: number
  ascent: number
  routes: number
  photos: number
  entries: number
  nights: number
  spent: Record<string, number>
  /** Reisetage je Monat (Jan … Dez) */
  months: number[]
  longestTrip: TripRow | null
  longestRoute: { name: string; trip: string; distance: number } | null
  highestRoute: { name: string; trip: string; ascent: number } | null
  rows: TripRow[]
}

const DAY = 86400_000
const t = (d: string) => Date.parse(`${d}T12:00:00Z`)

export function tripLength(a: string, b: string): number {
  return Math.max(1, Math.round((t(b) - t(a)) / DAY) + 1)
}

/** Jahre mit Reisen, neueste zuerst */
export function yearsOf(trips: TripIn[]): number[] {
  return [...new Set(trips.map((x) => Number(x.startDate.slice(0, 4))).filter(Boolean))].sort((a, b) => b - a)
}

/** Reisetage je Monat; eine Reise über den Monatswechsel zählt anteilig, nur Tage im gewählten Jahr */
export function daysPerMonth(trips: TripIn[], year: number | null, today: string): number[] {
  const m = Array(12).fill(0)
  for (const x of trips) {
    for (let d = t(x.startDate); d <= t(x.endDate) && d <= t(today); d += DAY) {
      const dt = new Date(d)
      if (year === null || dt.getUTCFullYear() === year) m[dt.getUTCMonth()]++
    }
  }
  return m
}

export function summarize(all: TripIn[], extra: Map<string, TripExtra>, year: number | null, today: string): Summary {
  const inYear = all.filter((x) => year === null || Number(x.startDate.slice(0, 4)) === year)
  const done = inYear.filter((x) => x.startDate <= today)
  const rows: TripRow[] = done
    .map((x) => {
      const e = extra.get(x.id)
      return {
        ...x,
        days: tripLength(x.startDate, x.endDate),
        distance: e?.routes.reduce((s, r) => s + r.distance, 0) ?? 0,
        ascent: e?.routes.reduce((s, r) => s + r.ascent, 0) ?? 0,
        photos: e?.photos ?? 0,
        entries: e?.entries ?? 0
      }
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
  const spent: Record<string, number> = {}
  let longestRoute: Summary['longestRoute'] = null
  let highestRoute: Summary['highestRoute'] = null
  for (const x of done) {
    const e = extra.get(x.id)
    if (!e) continue
    for (const [c, v] of Object.entries(e.spent)) spent[c] = Math.round(((spent[c] ?? 0) + v) * 100) / 100
    for (const r of e.routes) {
      if (!longestRoute || r.distance > longestRoute.distance) longestRoute = { name: r.name, trip: x.title, distance: r.distance }
      if (!highestRoute || r.ascent > highestRoute.ascent) highestRoute = { name: r.name, trip: x.title, ascent: r.ascent }
    }
  }
  return {
    trips: done.length,
    planned: inYear.length - done.length,
    days: rows.reduce((s, r) => s + r.days, 0),
    countries: [...new Set(done.flatMap((x) => x.countries ?? []))].sort(),
    distance: rows.reduce((s, r) => s + r.distance, 0),
    ascent: rows.reduce((s, r) => s + r.ascent, 0),
    routes: done.reduce((s, x) => s + (extra.get(x.id)?.routes.length ?? 0), 0),
    photos: rows.reduce((s, r) => s + r.photos, 0),
    entries: rows.reduce((s, r) => s + r.entries, 0),
    nights: done.reduce((s, x) => s + (extra.get(x.id)?.nights ?? 0), 0),
    spent,
    months: daysPerMonth(done, year, today),
    longestTrip: rows.reduce<TripRow | null>((best, r) => (!best || r.days > best.days ? r : best), null),
    longestRoute: longestRoute && longestRoute.distance > 0 ? longestRoute : null,
    highestRoute: highestRoute && highestRoute.ascent > 0 ? highestRoute : null,
    rows
  }
}
