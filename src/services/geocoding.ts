import { locale, t } from '@/core/i18n'
/**
 * Adresssuche über Nominatim (OpenStreetMap), https://nominatim.org
 * Nutzungsregeln: höchstens 1 Anfrage pro Sekunde, keine Suche beim Tippen – darum nur auf Knopfdruck.
 * Daten © OpenStreetMap-Mitwirkende, ODbL.
 */

export interface GeoResult {
  label: string
  lat: number
  lon: number
}

const URL_SEARCH = 'https://nominatim.openstreetmap.org/search'
let lastCall = 0

/** Wartet, damit zwischen zwei Anfragen mindestens 1,1 s liegen. */
async function throttle(): Promise<void> {
  const wait = lastCall + 1100 - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastCall = Date.now()
}

export async function searchAddress(query: string, signal?: AbortSignal): Promise<GeoResult[]> {
  const q = query.trim()
  if (q.length < 3) return []
  await throttle()
  const params = new URLSearchParams({ q, format: 'jsonv2', limit: '6', 'accept-language': 'de', addressdetails: '0' })
  const res = await fetch(`${URL_SEARCH}?${params}`, { signal, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(t('Adresssuche fehlgeschlagen ({0})', [res.status]))
  return parseNominatim(await res.json())
}

export function parseNominatim(json: unknown): GeoResult[] {
  if (!Array.isArray(json)) return []
  return json
    .map((r: Record<string, unknown>) => ({ label: String(r.display_name ?? ''), lat: Number(r.lat), lon: Number(r.lon) }))
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lon) && Math.abs(r.lat) <= 90 && Math.abs(r.lon) <= 180)
}

/** Entfernung in km (Luftlinie, Haversine). */
export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLon = rad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`
  return `${km.toLocaleString(locale(), { maximumFractionDigits: km < 10 ? 1 : 0 })} km`
}
