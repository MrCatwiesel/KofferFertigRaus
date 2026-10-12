/** Ein Punkt: Breite, Länge, Höhe in m (oder null), Zeit in Sekunden seit 1970 (oder null). */
export type TrackPoint = [lat: number, lon: number, ele: number | null, time: number | null]

/** Aufgezeichnete Tour (mit Zeiten) oder geplante Route (ohne). */
export type RouteKind = 'track' | 'route'

export type RouteFormat = 'gpx' | 'fit' | 'tcx' | 'kml' | 'kmz' | 'geojson'

/** Was eine Datei hergibt – vor dem Speichern. */
export interface ParsedRoute {
  name: string
  kind: RouteKind
  points: TrackPoint[]
}

export interface RouteStats {
  /** Meter */
  distance: number
  ascent: number
  descent: number
  minEle: number | null
  maxEle: number | null
  /** Sekunden seit 1970 */
  start: number | null
  end: number | null
  /** Sekunden (Ende − Start) */
  duration: number | null
}

/** Eine Route einer Reise (wird abgeglichen; die Originaldatei als Anhang). */
export interface Route {
  id: string
  tripId: string
  name: string
  kind: RouteKind
  /** #rrggbb */
  color: string
  /** Tag der Reise (YYYY-MM-DD) oder leer */
  date: string
  notes: string
  /** Auf Reise-Webseite und Lese-Links zeigen */
  showInShare: boolean
  /** Vereinfachte Strecke für Karte und Höhenprofil (höchstens ~2000 Punkte) */
  points: TrackPoint[]
  /** Stark vereinfacht (höchstens ~400 Punkte, ohne Zeit) – für Webseite und Lese-Links */
  preview: [number, number, number | null][]
  stats: RouteStats
  format: RouteFormat
  filename: string
  /** Originaldatei (z. B. vom Garmin) – zum späteren Herunterladen */
  original: Blob | null
  createdAt: string
  updatedAt: string
}

export type RouteDraft = Pick<Route, 'name' | 'color' | 'date' | 'notes' | 'showInShare'>

export const ROUTE_COLORS = ['#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#db2777', '#475569']

export const FORMAT_LABEL: Record<RouteFormat, string> = {
  gpx: 'GPX',
  fit: 'FIT (Garmin)',
  tcx: 'TCX',
  kml: 'KML',
  kmz: 'KMZ',
  geojson: 'GeoJSON'
}
