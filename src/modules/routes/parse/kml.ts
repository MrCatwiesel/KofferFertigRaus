import type { ParsedRoute, TrackPoint } from '../types'
import { blocks, decodeXml, isoToSeconds, num, text, validLatLon } from './xml'

/** "lon,lat[,alt] lon,lat …" */
function coordinates(s: string): TrackPoint[] {
  const out: TrackPoint[] = []
  for (const tuple of decodeXml(s).split(/\s+/)) {
    const [lon, lat, alt] = tuple.split(',').map((x) => num(x))
    if (validLatLon(lat ?? null, lon ?? null)) out.push([lat!, lon!, alt ?? null, null])
  }
  return out
}

/** gx:Track: <when> und <gx:coord>lon lat alt</gx:coord> */
function gxTrack(xml: string): TrackPoint[] {
  const when = [...xml.matchAll(/<when>([^<]*)<\/when>/gi)].map((m) => isoToSeconds(m[1].trim()))
  const coords = [...xml.matchAll(/<gx:coord>([^<]*)<\/gx:coord>/gi)].map((m) => m[1].trim().split(/\s+/).map(Number))
  const out: TrackPoint[] = []
  coords.forEach(([lon, lat, alt], i) => {
    if (validLatLon(lat, lon)) out.push([lat, lon, Number.isFinite(alt) ? alt : null, when[i] ?? null])
  })
  return out
}

/** KML (z. B. Google My Maps): jede Linie in einem Placemark wird eine Route. */
export function parseKml(xml: string, fallbackName: string): ParsedRoute[] {
  const out: ParsedRoute[] = []
  for (const pm of blocks(xml, 'Placemark')) {
    const name = text(pm, 'name') || fallbackName
    const tracks = blocks(pm, 'Track')
    if (tracks.length) {
      const pts = tracks.flatMap(gxTrack)
      if (pts.length >= 2) out.push({ name, kind: pts.some((p) => p[3] !== null) ? 'track' : 'route', points: pts })
      continue
    }
    const pts = blocks(pm, 'LineString').flatMap((ls) => coordinates(text(ls, 'coordinates')))
    if (pts.length >= 2) out.push({ name, kind: 'route', points: pts })
  }
  return out
}
