import { escapeHtml } from '@/core/html'
import type { RouteStats, TrackPoint } from './types'
import { haversine, rad } from '../../services/tracks'

// Zeichnen und Beschreiben liegt in services/tracks.ts (auch für Webseite und Lese-Links)
export { bounds, formatDistance, formatDuration, haversine, profileData, profileSvg, safeHex, statsLine, trackSvg } from '../../services/tracks'

/** Höhen glätten (gleitender Mittelwert über `w` Punkte) – GPS-Höhen springen sonst um einige Meter. */
function smoothedElevations(points: readonly TrackPoint[], w = 5): (number | null)[] {
  const half = Math.floor(w / 2)
  return points.map((_, i) => {
    let sum = 0
    let n = 0
    for (let j = Math.max(0, i - half); j <= Math.min(points.length - 1, i + half); j++) {
      const e = points[j][2]
      if (e !== null) {
        sum += e
        n++
      }
    }
    return points[i][2] === null || !n ? null : sum / n
  })
}

/**
 * Kennzahlen einer Strecke. Auf- und Abstieg aus geglätteten Höhen mit 3-m-Schwelle,
 * damit Messrauschen nicht als Höhenmeter zählt.
 */
export function computeStats(points: TrackPoint[], threshold = 3): RouteStats {
  let distance = 0
  let ascent = 0
  let descent = 0
  let minEle: number | null = null
  let maxEle: number | null = null
  let ref: number | null = null
  const smooth = smoothedElevations(points)
  for (let i = 0; i < points.length; i++) {
    if (i) distance += haversine(points[i - 1], points[i])
    const raw = points[i][2]
    if (raw !== null) {
      minEle = minEle === null ? raw : Math.min(minEle, raw)
      maxEle = maxEle === null ? raw : Math.max(maxEle, raw)
    }
    const e = smooth[i]
    if (e === null) continue
    if (ref === null) ref = e
    else if (e - ref >= threshold) {
      ascent += e - ref
      ref = e
    } else if (ref - e >= threshold) {
      descent += ref - e
      ref = e
    }
  }
  const times = points.map((p) => p[3]).filter((t): t is number => t !== null)
  const start = times.length ? Math.min(...times.slice(0, 50)) : null
  const end = times.length ? Math.max(...times.slice(-50)) : null
  return {
    distance: Math.round(distance),
    ascent: Math.round(ascent),
    descent: Math.round(descent),
    minEle: minEle === null ? null : Math.round(minEle),
    maxEle: maxEle === null ? null : Math.round(maxEle),
    start,
    end,
    duration: start !== null && end !== null && end > start ? end - start : null
  }
}

/** Abstand eines Punkts zur Strecke a–b in Metern (lokal flach gerechnet – reicht für kurze Abschnitte). */
function segmentDistance(p: TrackPoint, a: TrackPoint, b: TrackPoint): number {
  const k = Math.cos(rad(a[0]))
  const ax = 0
  const ay = 0
  const bx = (b[1] - a[1]) * k
  const by = b[0] - a[0]
  const px = (p[1] - a[1]) * k
  const py = p[0] - a[0]
  const len2 = bx * bx + by * by
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * bx + (py - ay) * by) / len2)) : 0
  const dx = px - t * bx
  const dy = py - t * by
  return Math.sqrt(dx * dx + dy * dy) * 111320
}

/** Douglas-Peucker mit fester Toleranz in Metern (ohne Rekursion, auch für 50 000 Punkte). */
export function simplify(points: TrackPoint[], tolerance: number): TrackPoint[] {
  if (points.length <= 2) return points.slice()
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack: [number, number][] = [[0, points.length - 1]]
  while (stack.length) {
    const [s, e] = stack.pop()!
    let maxD = 0
    let idx = -1
    for (let i = s + 1; i < e; i++) {
      const d = segmentDistance(points[i], points[s], points[e])
      if (d > maxD) {
        maxD = d
        idx = i
      }
    }
    if (idx > 0 && maxD > tolerance) {
      keep[idx] = 1
      stack.push([s, idx], [idx, e])
    }
  }
  return points.filter((_, i) => keep[i])
}

/** Vereinfacht, bis höchstens `max` Punkte übrig sind (Toleranz wächst schrittweise). */
export function simplifyTo(points: TrackPoint[], max: number): TrackPoint[] {
  let tol = 2
  let out = simplify(points, tol)
  while (out.length > max && tol < 5000) {
    tol *= 1.6
    out = simplify(points, tol)
  }
  return out
}

/** Koordinaten auf ~1 m runden, Höhe auf 0,1 m – spart Platz. */
export function roundPoints(points: TrackPoint[]): TrackPoint[] {
  return points.map(([la, lo, e, t]) => [Math.round(la * 1e5) / 1e5, Math.round(lo * 1e5) / 1e5, e === null ? null : Math.round(e * 10) / 10, t])
}

/** Tag (YYYY-MM-DD, Ortszeit) des ersten Zeitstempels – oder ''. */
export function dateOf(points: TrackPoint[]): string {
  const t = points.find((p) => p[3] !== null)?.[3]
  if (t === undefined || t === null) return ''
  const d = new Date(t * 1000)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const xmlEsc = escapeHtml

/** GPX-Datei aus einer Strecke (z. B. für Garmin Express/Basecamp oder andere Apps). */
export function toGpx(name: string, points: TrackPoint[], kind: 'track' | 'route' = 'track'): string {
  const pt = (tag: string, [la, lo, e, t]: TrackPoint) =>
    `<${tag} lat="${la}" lon="${lo}">${e !== null ? `<ele>${e}</ele>` : ''}${t !== null ? `<time>${new Date(t * 1000).toISOString()}</time>` : ''}</${tag}>`
  const body =
    kind === 'route'
      ? `<rte><name>${xmlEsc(name)}</name>${points.map((p) => pt('rtept', p)).join('')}</rte>`
      : `<trk><name>${xmlEsc(name)}</name><trkseg>${points.map((p) => pt('trkpt', p)).join('')}</trkseg></trk>`
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="KofferFertigRaus" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${xmlEsc(name)}</name></metadata>${body}</gpx>\n`
}

/** Dateiname für den Export, z. B. "monte-baldo.gpx" */
export function gpxFileName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return `${slug || 'route'}.gpx`
}

/**
 * Gehzeit nach DIN 33466 (Wanderwege): 4 km/h in der Ebene, 300 Hm/h bergauf, 500 Hm/h bergab;
 * die größere der beiden Zeiten plus die Hälfte der kleineren. Ergebnis in Sekunden.
 */
export function hikingTime(distance: number, ascent: number, descent: number): number {
  const horizontal = distance / 1000 / 4
  const vertical = ascent / 300 + descent / 500
  return Math.round((Math.max(horizontal, vertical) + Math.min(horizontal, vertical) / 2) * 3600)
}

/** Haben zu wenige Punkte eine Höhe? (z. B. Aufzeichnung ohne Höhenmesser oder Export ohne Höhen) */
export function lacksElevation(points: TrackPoint[]): boolean {
  if (points.length < 2) return false
  return points.filter((p) => p[2] !== null && Number.isFinite(p[2])).length < points.length * 0.5
}

/**
 * Höhen für alle Punkte aus einigen Stützstellen (Index → Höhe) ergänzen, dazwischen linear nach Wegstrecke.
 * Vorhandene Höhen bleiben, wenn `keep` gesetzt ist.
 */
export function interpolateElevations(points: TrackPoint[], samples: { index: number; ele: number | null }[], keep = false): TrackPoint[] {
  const known = samples.filter((s): s is { index: number; ele: number } => s.ele !== null && Number.isFinite(s.ele)).sort((a, b) => a.index - b.index)
  if (!known.length) return points
  // Wegstrecke bis zu jedem Punkt
  const dist: number[] = [0]
  for (let i = 1; i < points.length; i++) dist.push(dist[i - 1] + haversine(points[i - 1], points[i]))
  let k = 0
  return points.map((p, i) => {
    if (keep && p[2] !== null) return p
    while (k < known.length - 1 && known[k + 1].index <= i) k++
    const a = known[k]
    const b = known[Math.min(k + 1, known.length - 1)]
    let ele = a.ele
    if (i <= known[0].index) ele = known[0].ele
    else if (b.index > a.index && i > a.index) {
      const span = dist[b.index] - dist[a.index]
      const t = span > 0 ? (dist[i] - dist[a.index]) / span : 0
      ele = a.ele + (b.ele - a.ele) * Math.min(1, t)
    }
    return [p[0], p[1], Math.round(ele * 10) / 10, p[3]] as TrackPoint
  })
}
