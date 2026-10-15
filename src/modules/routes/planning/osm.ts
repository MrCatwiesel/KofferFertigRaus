/**
 * Wanderwege, Rad- und MTB-Strecken aus OpenStreetMap (Overpass-Abfragen).
 * Gesucht werden ausgeschilderte Routen (Relationen route=hiking/foot/bicycle/mtb) im Kartenausschnitt.
 * Die Wege einer Route liegen in OSM als einzelne Abschnitte vor – stitch() fügt sie zu einer Linie zusammen.
 */
import { haversine } from '../../../services/tracks'
import { t, language } from '@/i18n'

export type TrailType = 'hiking' | 'bicycle' | 'mtb'

export const TRAIL_TYPES: Record<TrailType, { label: string; one: string; routes: string; icon: string }> = {
  hiking: { label: t('Wanderwege'), one: t('Wanderweg'), routes: 'hiking|foot', icon: 'person-walking' },
  bicycle: { label: t('Radwege'), one: t('Radweg'), routes: 'bicycle', icon: 'bicycle' },
  mtb: { label: t('MTB-Strecken'), one: t('MTB-Strecke'), routes: 'mtb', icon: 'bicycle' }
}

/** Größter Suchausschnitt (Grad) – größere Abfragen dauern zu lange */
export const MAX_SEARCH_SPAN = 0.6

export interface TrailHit {
  id: number
  name: string
  ref: string
  network: string
  networkLabel: string
  from: string
  to: string
  distance: string
  operator: string
  website: string
  type: TrailType
}

const NETWORKS: Record<string, string> = {
  iwn: 'international', nwn: 'national', rwn: 'regional', lwn: 'lokal',
  icn: 'international', ncn: 'national', rcn: 'regional', lcn: 'lokal'
}
const RANK: Record<string, number> = { iwn: 0, icn: 0, nwn: 1, ncn: 1, rwn: 2, rcn: 2, lwn: 3, lcn: 3 }

/** Text für eine Overpass-Regex sicher machen (Anführungszeichen raus, Sonderzeichen maskiert) */
function regexSafe(s: string): string {
  return s
    .replace(/["\\\n\r]/g, '')
    .replace(/[.*+?^${}()|[\]]/g, '\\$&')
    .slice(0, 60)
}

/** Abfrage: Routen eines Typs im Ausschnitt [W,S,O,N], optional nach Name gefiltert */
export function searchQuery(bbox: [number, number, number, number], type: TrailType, name = ''): string {
  const [w, s, e, n] = bbox.map((v) => Math.round(v * 1e5) / 1e5)
  const nameFilter = name.trim() ? `["name"~"${regexSafe(name.trim())}",i]` : ''
  return `[out:json][timeout:25];relation["type"="route"]["route"~"^(${TRAIL_TYPES[type].routes})$"]${nameFilter}(${s},${w},${n},${e});out tags 150;`
}

/** Abfrage: vollständige Geometrie einer Route (samt Unter-Routen) */
export function geometryQuery(id: number): string {
  return `[out:json][timeout:60];relation(${Math.trunc(id)});(._;rel(r););out geom;`
}

interface OsmElement {
  type: string
  id: number
  tags?: Record<string, string>
  members?: { type: string; ref: number; role: string; geometry?: { lat: number; lon: number }[] }[]
}

export function parseHits(json: { elements?: OsmElement[] }, type: TrailType): TrailHit[] {
  return (json.elements ?? [])
    .filter((e) => e.type === 'relation' && e.tags)
    .map((e) => {
      const tags = e.tags!
      const network = tags.network ?? ''
      return {
        id: e.id,
        name: tags[`name:${language()}`] || tags.name || tags.ref || t('Route {id}', { id: e.id }),
        ref: tags.ref ?? '',
        network,
        networkLabel: NETWORKS[network] ?? '',
        from: tags.from ?? '',
        to: tags.to ?? '',
        distance: tags.distance ?? '',
        operator: tags.operator ?? '',
        website: /^https?:\/\//.test(tags.website ?? '') ? tags.website : '',
        type
      }
    })
    .sort((a, b) => (RANK[a.network] ?? 4) - (RANK[b.network] ?? 4) || a.name.localeCompare(b.name, 'de'))
}

type LL = [number, number]
const near = (a: LL, b: LL, tol: number) => haversine(a, b) <= tol

/**
 * Wegabschnitte zu einer durchgehenden Linie zusammenfügen.
 * Greift jeweils den Abschnitt, der am Ende (oder Anfang) der Kette anschließt; Lücken werden überbrückt.
 */
export function stitch(segments: LL[][], tol = 25): LL[] {
  const rest = segments.filter((s) => s.length >= 2).map((s) => [...s])
  if (!rest.length) return []
  const chains: LL[][] = []
  while (rest.length) {
    let chain = rest.shift()!
    let grown = true
    while (grown && rest.length) {
      grown = false
      const head = chain[0]
      const tail = chain[chain.length - 1]
      for (let i = 0; i < rest.length; i++) {
        const s = rest[i]
        const first = s[0]
        const last = s[s.length - 1]
        if (near(tail, first, tol)) chain = [...chain, ...s.slice(1)]
        else if (near(tail, last, tol)) chain = [...chain, ...[...s].reverse().slice(1)]
        else if (near(head, last, tol)) chain = [...s.slice(0, -1), ...chain]
        else if (near(head, first, tol)) chain = [...[...s].reverse().slice(0, -1), ...chain]
        else continue
        rest.splice(i, 1)
        grown = true
        break
      }
    }
    chains.push(chain)
  }
  // Ketten nach Nähe aneinanderhängen (längste zuerst)
  chains.sort((a, b) => b.length - a.length)
  let line = chains.shift()!
  while (chains.length) {
    const tail = line[line.length - 1]
    let best = 0
    let bestD = Infinity
    let rev = false
    chains.forEach((c, i) => {
      const d1 = haversine(tail, c[0])
      const d2 = haversine(tail, c[c.length - 1])
      if (d1 < bestD) [bestD, best, rev] = [d1, i, false]
      if (d2 < bestD) [bestD, best, rev] = [d2, i, true]
    })
    const c = chains.splice(best, 1)[0]
    line = [...line, ...(rev ? [...c].reverse() : c)]
  }
  return line
}

/** Linie einer Route aus der Overpass-Antwort (Wege der Route und ihrer Unter-Routen) */
export function relationLine(json: { elements?: OsmElement[] }): LL[] {
  const segments: LL[][] = []
  for (const el of json.elements ?? []) {
    if (el.type !== 'relation') continue
    for (const m of el.members ?? []) {
      // Wegweiser, Haltestellen usw. gehören nicht zur Linie
      if (m.type !== 'way' || !m.geometry || /^(platform|guidepost|stop|marker)/.test(m.role)) continue
      segments.push(m.geometry.map((g) => [g.lat, g.lon] as LL))
    }
  }
  return stitch(segments)
}
