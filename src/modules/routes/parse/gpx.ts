import type { ParsedRoute, TrackPoint } from '../types'
import { attr, blocks, isoToSeconds, num, text, validLatLon } from './xml'

function points(xml: string, tag: 'trkpt' | 'rtept'): TrackPoint[] {
  const re = new RegExp(`<${tag}\\b([^>]*?)(?:\\/>|>([\\s\\S]*?)<\\/${tag}>)`, 'gi')
  const out: TrackPoint[] = []
  for (const m of xml.matchAll(re)) {
    const lat = num(attr(m[1], 'lat'))
    const lon = num(attr(m[1], 'lon'))
    if (!validLatLon(lat, lon)) continue
    const body = m[2] ?? ''
    out.push([lat!, lon!, num(text(body, 'ele')), isoToSeconds(text(body, 'time'))])
  }
  return out
}

/** GPX: jede Spur (trk) und jede Route (rte) wird eine eigene Route. */
export function parseGpx(xml: string, fallbackName: string): ParsedRoute[] {
  const meta = blocks(xml, 'metadata')[0] ?? ''
  const docName = text(meta, 'name') || fallbackName
  const out: ParsedRoute[] = []
  const tracks = blocks(xml, 'trk')
  tracks.forEach((trk, i) => {
    // Name steht vor dem ersten Segment
    const head = trk.split(/<trkseg\b/i)[0]
    const pts = points(trk, 'trkpt')
    if (pts.length >= 2) out.push({ name: text(head, 'name') || (tracks.length > 1 ? `${docName} (${i + 1})` : docName), kind: 'track', points: pts })
  })
  const routes = blocks(xml, 'rte')
  routes.forEach((rte, i) => {
    const head = rte.split(/<rtept\b/i)[0]
    const pts = points(rte, 'rtept')
    if (pts.length >= 2) out.push({ name: text(head, 'name') || (routes.length > 1 ? `${docName} (${i + 1})` : docName), kind: 'route', points: pts })
  })
  return out
}
