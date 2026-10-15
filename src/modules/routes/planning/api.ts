/**
 * Zugriff auf Wanderwege-Suche (Overpass) und Routenplaner (BRouter).
 * Mit eingerichtetem Abgleich-Server laufen die Anfragen über ihn (kein CORS-Problem, höflicher gegenüber den
 * freien Diensten); sonst direkt aus dem Browser.
 */
import { ServerClient } from '@/core/sync/client'
import { geometryQuery, parseHits, relationLine, searchQuery, type TrailHit, type TrailType } from './osm'
import { lonlats, parseBrouter, type PlannedRoute } from './brouter'
import { t } from '@/i18n'

const OVERPASS = 'https://overpass-api.de/api/interpreter'
const BROUTER = 'https://brouter.de/brouter'
const ELEVATION = 'https://api.open-meteo.com/v1/elevation'

async function overpass(query: string): Promise<unknown> {
  let res: Response
  try {
    res = await fetch(OVERPASS, { method: 'POST', body: new URLSearchParams({ data: query }) })
  } catch {
    throw new Error(navigator.onLine ? t('OpenStreetMap-Suche nicht erreichbar.') : t('Für die Suche wird Internet benötigt.'))
  }
  if (res.status === 429 || res.status === 504) throw new Error(t('Die OpenStreetMap-Suche ist gerade ausgelastet – bitte gleich noch einmal.'))
  if (!res.ok) throw new Error(t('OpenStreetMap-Suche fehlgeschlagen ({status}).', { status: res.status }))
  return res.json()
}

export class RoutingApi {
  private constructor(private readonly client: ServerClient | null) {}

  static async create(): Promise<RoutingApi> {
    return new RoutingApi(await ServerClient.fromSync())
  }

  get viaServer(): boolean {
    return !!this.client
  }

  async searchTrails(bbox: [number, number, number, number], type: TrailType, name: string): Promise<TrailHit[]> {
    if (this.client) {
      const q = new URLSearchParams({ bbox: bbox.join(','), typ: type, name })
      return parseHits(await this.client.json(`/api/routing/wanderwege?${q}`), type)
    }
    return parseHits((await overpass(searchQuery(bbox, type, name))) as never, type)
  }

  async trailLine(id: number): Promise<[number, number][]> {
    const json = this.client ? await this.client.json(`/api/routing/wanderwege/${id}`) : await overpass(geometryQuery(id))
    const line = relationLine(json as never)
    if (line.length < 2) throw new Error(t('Für diese Route liefert OpenStreetMap keinen Verlauf.'))
    return line
  }

  async plan(points: { lat: number; lon: number }[], profile: string): Promise<PlannedRoute> {
    const q = new URLSearchParams({ lonlats: lonlats(points), profile, alternativeidx: '0', format: 'geojson' })
    if (this.client) return parseBrouter(await this.client.json(`/api/routing/strecke?${q}`))
    let res: Response
    try {
      res = await fetch(`${BROUTER}?${q}`)
    } catch {
      throw new Error(navigator.onLine ? t('Routenplaner nicht erreichbar – mit eigenem Server (Geräte-Abgleich) klappt es zuverlässiger.') : t('Für die Planung wird Internet benötigt.'))
    }
    const text = await res.text()
    if (!res.ok) throw new Error(text.trim().slice(0, 200) || t('Routenplaner-Fehler ({status}).', { status: res.status }))
    return parseBrouter(JSON.parse(text))
  }
}

/** Höhen zu Punkten holen (Open-Meteo, je Anfrage höchstens 100 Punkte). Fehler → null-Höhen. */
export async function fetchElevations(points: [number, number][]): Promise<(number | null)[]> {
  const out: (number | null)[] = []
  for (let i = 0; i < points.length; i += 100) {
    const part = points.slice(i, i + 100)
    try {
      const q = new URLSearchParams({ latitude: part.map((p) => p[0].toFixed(5)).join(','), longitude: part.map((p) => p[1].toFixed(5)).join(',') })
      const res = await fetch(`${ELEVATION}?${q}`)
      const json = (await res.json()) as { elevation?: number[] }
      out.push(...part.map((_, k) => (Number.isFinite(json.elevation?.[k]) ? json.elevation![k] : null)))
    } catch {
      out.push(...part.map(() => null))
    }
  }
  return out
}
