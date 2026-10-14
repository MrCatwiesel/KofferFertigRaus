import { locale, t } from '@/core/i18n'
/**
 * Strecken zeichnen und beschreiben – reine Funktionen ohne Datenbank.
 * Genutzt von Routen-Modul, Reise-Webseite und Lese-Link-Seite.
 */
/** Kennzahlen, die für die Beschreibung reichen. */
export interface TrackSummary {
  distance: number
  ascent: number
  descent: number
  duration: number | null
}

const R = 6371008.8 // mittlerer Erdradius in m
export const rad = (d: number) => (d * Math.PI) / 180

/** Entfernung zweier Punkte in Metern (Haversine). */
export function haversine(a: readonly [number, number, ...unknown[]], b: readonly [number, number, ...unknown[]]): number {
  const dLat = rad(b[0] - a[0])
  const dLon = rad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

export function bounds(points: readonly (readonly [number, number, ...unknown[]])[]): [[number, number], [number, number]] | null {
  if (!points.length) return null
  let s = 90
  let w = 180
  let n = -90
  let e = -180
  for (const p of points) {
    s = Math.min(s, p[0])
    n = Math.max(n, p[0])
    w = Math.min(w, p[1])
    e = Math.max(e, p[1])
  }
  return [
    [s, w],
    [n, e]
  ]
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toLocaleString(locale(), { maximumFractionDigits: m < 100000 ? 1 : 0 })} km`
}

export function formatDuration(s: number | null): string {
  if (s === null) return ''
  const total = Math.round(s / 60) // erst auf Minuten runden, sonst "4 h 60 min"
  const h = Math.floor(total / 60)
  const m = total % 60
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : `${m} min`
}

/** "12,3 km · ↗ 850 m · ↘ 850 m · 4 h 10 min" */
export function statsLine(st: TrackSummary): string {
  return [
    formatDistance(st.distance),
    st.ascent ? `↗ ${st.ascent.toLocaleString(locale())} m` : '',
    st.descent ? `↘ ${st.descent.toLocaleString(locale())} m` : '',
    formatDuration(st.duration)
  ]
    .filter(Boolean)
    .join(' · ')
}

/** Nur gültige Hex-Farben (für SVG/HTML). */
export function safeHex(c: string, fallback = '#e11d48'): string {
  return /^#[0-9a-f]{6}$/i.test(c) ? c.toLowerCase() : fallback
}

type PlainPoint = readonly [number, number, number | null, ...unknown[]]

/**
 * Strecke als SVG (ohne Kartenhintergrund): flach projiziert, eingepasst, mit Start- und Zielpunkt.
 * Funktioniert offline und in der eigenständigen HTML-Datei.
 */
export function trackSvg(points: readonly PlainPoint[], opts: { width?: number; height?: number; color?: string; stroke?: number } = {}): string {
  const W = opts.width ?? 600
  const H = opts.height ?? 340
  const color = safeHex(opts.color ?? '')
  const b = bounds(points)
  if (!b || points.length < 2) return ''
  const k = Math.cos(rad((b[0][0] + b[1][0]) / 2))
  const spanX = Math.max((b[1][1] - b[0][1]) * k, 1e-9)
  const spanY = Math.max(b[1][0] - b[0][0], 1e-9)
  const pad = 14
  const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY)
  const ox = (W - spanX * scale) / 2
  const oy = (H - spanY * scale) / 2
  const xy = (p: PlainPoint) => [ox + (p[1] - b[0][1]) * k * scale, H - (oy + (p[0] - b[0][0]) * scale)] as const
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${xy(p)[0].toFixed(1)} ${xy(p)[1].toFixed(1)}`).join('')
  const [sx, sy] = xy(points[0])
  const [ex, ey] = xy(points[points.length - 1])
  const sw = opts.stroke ?? 3.5
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="nww-track" role="img" aria-label="${t('Streckenverlauf')}"><path d="${d}" fill="none" stroke="#fff" stroke-width="${sw + 3}" stroke-linejoin="round" stroke-linecap="round" opacity=".8"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="6" fill="#16a34a" stroke="#fff" stroke-width="2"/><circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="6" fill="#111827" stroke="#fff" stroke-width="2"/></svg>`
}

/** Höhenprofil: Entfernung (x) gegen Höhe (y). */
export function profileData(points: readonly PlainPoint[]): { d: number; e: number }[] {
  const out: { d: number; e: number }[] = []
  let dist = 0
  for (let i = 0; i < points.length; i++) {
    if (i) dist += haversine(points[i - 1], points[i])
    const e = points[i][2]
    if (e !== null) out.push({ d: dist, e })
  }
  return out
}

/** Höhenprofil als SVG mit Achsenbeschriftung (min/max Höhe, Gesamtlänge). */
export function profileSvg(points: readonly PlainPoint[], opts: { width?: number; height?: number; color?: string } = {}): string {
  const data = profileData(points)
  if (data.length < 2) return ''
  const W = opts.width ?? 600
  const H = opts.height ?? 140
  const color = safeHex(opts.color ?? '')
  const left = 64
  const bottom = 20
  const top = 8
  const right = 8
  const minE = Math.min(...data.map((p) => p.e))
  const maxE = Math.max(...data.map((p) => p.e))
  const spanE = Math.max(maxE - minE, 20)
  const total = data[data.length - 1].d || 1
  const x = (d: number) => left + (d / total) * (W - left - right)
  const y = (e: number) => top + (1 - (e - minE) / spanE) * (H - top - bottom)
  const line = data.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)} ${y(p.e).toFixed(1)}`).join('')
  const area = `${line}L${x(total).toFixed(1)} ${H - bottom}L${left} ${H - bottom}Z`
  const label = (v: number) => `${Math.round(v).toLocaleString(locale())} m`
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="nww-profile" role="img" aria-label="${t('Höhenprofil von {0} bis {1}', [label(minE), label(maxE)])}"><path d="${area}" fill="${color}" opacity=".18"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/><line x1="${left}" y1="${H - bottom}" x2="${W - right}" y2="${H - bottom}" stroke="currentColor" opacity=".25"/><g font-size="11" fill="currentColor" opacity=".7" font-family="system-ui,sans-serif"><text x="${left - 6}" y="${y(maxE) + 4}" text-anchor="end">${label(maxE)}</text><text x="${left - 6}" y="${y(minE) + 4}" text-anchor="end">${label(minE)}</text><text x="${left}" y="${H - 5}">0</text><text x="${W - right}" y="${H - 5}" text-anchor="end">${formatDistance(total)}</text></g></svg>`
}


/**
 * Mehrere Strecken gemeinsam als SVG (Übersichtskarte ohne Hintergrund), jede in ihrer Farbe.
 * Gleiche Projektion wie trackSvg, damit die Lage der Touren zueinander stimmt.
 */
export function routesSvg(routes: readonly { points: readonly PlainPoint[]; color: string }[], opts: { width?: number; height?: number; stroke?: number } = {}): string {
  const W = opts.width ?? 600
  const H = opts.height ?? 400
  const all = routes.flatMap((r) => r.points)
  const b = bounds(all)
  if (!b || all.length < 2) return ''
  const k = Math.cos(rad((b[0][0] + b[1][0]) / 2))
  const spanX = Math.max((b[1][1] - b[0][1]) * k, 1e-9)
  const spanY = Math.max(b[1][0] - b[0][0], 1e-9)
  const pad = 16
  const scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY)
  const ox = (W - spanX * scale) / 2
  const oy = (H - spanY * scale) / 2
  const xy = (p: PlainPoint) => `${(ox + (p[1] - b[0][1]) * k * scale).toFixed(1)} ${(H - (oy + (p[0] - b[0][0]) * scale)).toFixed(1)}`
  const sw = opts.stroke ?? 3
  const paths = routes
    .filter((r) => r.points.length > 1)
    .map((r) => {
      const d = r.points.map((p, i) => `${i ? 'L' : 'M'}${xy(p)}`).join('')
      return `<path d="${d}" fill="none" stroke="#fff" stroke-width="${sw + 3}" stroke-linejoin="round" stroke-linecap="round" opacity=".8"/><path d="${d}" fill="none" stroke="${safeHex(r.color)}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`
    })
    .join('')
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" class="nww-routes" role="img" aria-label="${t('Übersicht aller Touren')}">${paths}</svg>`
}
