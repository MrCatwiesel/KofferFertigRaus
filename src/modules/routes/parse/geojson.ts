import type { ParsedRoute, TrackPoint } from '../types'
import { validLatLon } from './xml'

type Pos = number[]
interface Geometry {
  type: string
  coordinates?: unknown
  geometries?: Geometry[]
}
interface Feature {
  type: 'Feature'
  geometry: Geometry | null
  properties?: Record<string, unknown> | null
}

const toPoints = (line: Pos[]): TrackPoint[] =>
  line.filter((p) => validLatLon(p[1], p[0])).map((p) => [p[1], p[0], Number.isFinite(p[2]) ? p[2] : null, null])

function lines(g: Geometry | null): Pos[][] {
  if (!g) return []
  if (g.type === 'LineString') return [g.coordinates as Pos[]]
  if (g.type === 'MultiLineString') return g.coordinates as Pos[][]
  if (g.type === 'GeometryCollection') return (g.geometries ?? []).flatMap(lines)
  return []
}

/** GeoJSON: Linien (auch Multi) aus Features. */
export function parseGeoJson(json: string, fallbackName: string): ParsedRoute[] {
  const data = JSON.parse(json) as { type: string; features?: Feature[]; geometry?: Geometry | null; properties?: Record<string, unknown> | null } & Geometry
  let features: Feature[]
  if (data.type === 'FeatureCollection') features = data.features ?? []
  else if (data.type === 'Feature') features = [{ type: 'Feature', geometry: data.geometry ?? null, properties: data.properties ?? {} }]
  else features = [{ type: 'Feature', geometry: data, properties: {} }]
  const out: ParsedRoute[] = []
  for (const f of features) {
    const pts = lines(f.geometry).flatMap(toPoints)
    const name = typeof f.properties?.name === 'string' && f.properties.name ? f.properties.name : fallbackName
    if (pts.length >= 2) out.push({ name, kind: 'route', points: pts })
  }
  return out
}
