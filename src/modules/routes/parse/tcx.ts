import type { ParsedRoute, TrackPoint } from '../types'
import { blocks, isoToSeconds, num, text, validLatLon } from './xml'

function trackpoints(xml: string): TrackPoint[] {
  const out: TrackPoint[] = []
  for (const tp of blocks(xml, 'Trackpoint')) {
    const pos = blocks(tp, 'Position')[0] ?? ''
    const lat = num(text(pos, 'LatitudeDegrees'))
    const lon = num(text(pos, 'LongitudeDegrees'))
    if (validLatLon(lat, lon)) out.push([lat!, lon!, num(text(tp, 'AltitudeMeters')), isoToSeconds(text(tp, 'Time'))])
  }
  return out
}

/** TCX (Garmin Training Center): Aktivitäten und Strecken (Courses). */
export function parseTcx(xml: string, fallbackName: string): ParsedRoute[] {
  const out: ParsedRoute[] = []
  for (const a of blocks(xml, 'Activity')) {
    const pts = trackpoints(a)
    if (pts.length >= 2) out.push({ name: fallbackName, kind: 'track', points: pts })
  }
  for (const c of blocks(xml, 'Course')) {
    const pts = trackpoints(c)
    if (pts.length >= 2) out.push({ name: text(c, 'Name') || fallbackName, kind: 'route', points: pts })
  }
  return out
}
