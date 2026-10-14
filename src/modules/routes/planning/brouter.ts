/**
 * Routenplanung von A nach B mit BRouter (freier Routenplaner auf OpenStreetMap-Basis, liefert Höhen mit).
 * https://brouter.de – über den eigenen Server angefragt (oder direkt, falls kein Server eingerichtet ist).
 */
import type { TrackPoint } from '../types'
import { N_, t, translated } from '@/core/i18n'

export const PROFILES = translated([
  { id: 'hiking-mountain', label: N_('Wandern'), icon: 'person-walking' },
  { id: 'trekking', label: N_('Fahrrad'), icon: 'bicycle' },
  { id: 'fastbike', label: N_('Rennrad'), icon: 'bicycle' },
  { id: 'car-fast', label: N_('Auto'), icon: 'car-front' },
  { id: 'shortest', label: N_('Kürzester Weg'), icon: 'rulers' }
] as const)
export type ProfileId = (typeof PROFILES)[number]['id']
export const PROFILE_IDS = PROFILES.map((p) => p.id) as readonly string[]

/** "lon,lat|lon,lat" für BRouter */
export function lonlats(points: { lat: number; lon: number }[]): string {
  return points.map((p) => `${p.lon.toFixed(6)},${p.lat.toFixed(6)}`).join('|')
}

export interface PlannedRoute {
  points: TrackPoint[]
  distance: number
  ascent: number
  /** Geschätzte Dauer in Sekunden (vom Planer, je Profil) */
  time: number | null
}

/** Antwort von BRouter (GeoJSON) lesen */
export function parseBrouter(json: unknown): PlannedRoute {
  const f = (json as { features?: { geometry?: { coordinates?: number[][] }; properties?: Record<string, string> }[] })?.features?.[0]
  const coords = f?.geometry?.coordinates
  if (!Array.isArray(coords) || coords.length < 2) throw new Error(t('Der Routenplaner hat keine Strecke gefunden.'))
  const p = f?.properties ?? {}
  const num = (v: string | undefined) => (v !== undefined && Number.isFinite(Number(v)) ? Number(v) : null)
  return {
    points: coords.map(([lon, lat, ele]) => [lat, lon, Number.isFinite(ele) ? ele : null, null] as TrackPoint),
    distance: num(p['track-length']) ?? 0,
    ascent: num(p['filtered ascend']) ?? num(p['plain-ascend']) ?? 0,
    time: num(p['total-time'])
  }
}
