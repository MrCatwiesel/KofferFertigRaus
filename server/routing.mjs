/**
 * Wanderwege-Suche (Overpass/OpenStreetMap) und Routenplaner (BRouter) über den eigenen Server.
 * Vorteile gegenüber direkten Anfragen aus der App: kein CORS-Problem, ein ordentlicher User-Agent für die
 * freien Dienste, kurzer Zwischenspeicher (gleiche Suche → keine neue Anfrage), Begrenzung paralleler Anfragen.
 *
 * Abfragen werden hier gebaut – die App kann keine beliebigen Overpass-Abfragen durchreichen.
 */
import { HttpError, send } from './http.mjs'

const TYPES = { hiking: 'hiking|foot', bicycle: 'bicycle', mtb: 'mtb' }
const PROFILES = new Set(['hiking-mountain', 'trekking', 'fastbike', 'car-fast', 'shortest'])
const LONLATS_RE = /^-?\d{1,3}(\.\d{1,7})?,-?\d{1,2}(\.\d{1,7})?(\|-?\d{1,3}(\.\d{1,7})?,-?\d{1,2}(\.\d{1,7})?){1,15}$/
const MAX_SPAN = 0.8
const CACHE_MS = 3600_000
const MAX_PARALLEL = 3

const regexSafe = (s) =>
  String(s ?? '')
    .replace(/["\\\n\r]/g, '')
    .replace(/[.*+?^${}()|[\]]/g, '\\$&')
    .slice(0, 60)

export function createRouting(opts = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch
  const overpassUrl = opts.overpassUrl || 'https://overpass-api.de/api/interpreter'
  const brouterUrl = opts.brouterUrl || 'https://brouter.de/brouter'
  const ua = `NixWieWeg/${opts.version ?? '1'} (selbst gehosteter Reiseplaner)`
  const cache = new Map()
  let active = 0

  async function upstream(key, doFetch) {
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < CACHE_MS) return hit.body
    if (active >= MAX_PARALLEL) throw new HttpError(429, 'Gerade laufen schon mehrere Suchen – bitte kurz warten.')
    active++
    try {
      const res = await doFetch()
      const body = await res.text()
      if (res.status === 429 || res.status === 504) throw new HttpError(503, 'Der Kartendienst ist gerade ausgelastet – bitte gleich noch einmal.')
      if (!res.ok) throw new HttpError(502, body.trim().split('\n')[0].slice(0, 200) || `Kartendienst-Fehler (${res.status}).`)
      // Zwischenspeicher begrenzen: höchstens 100 Einträge und etwa 30 MB
      cache.set(key, { at: Date.now(), body })
      let bytes = 0
      for (const v of cache.values()) bytes += v.body.length
      while (cache.size > 100 || bytes > 30_000_000) {
        const k = cache.keys().next().value
        bytes -= cache.get(k).body.length
        cache.delete(k)
      }
      return body
    } catch (e) {
      if (e instanceof HttpError) throw e
      throw new HttpError(502, 'Kartendienst nicht erreichbar.')
    } finally {
      active--
    }
  }

  const overpass = (query) =>
    upstream(`op:${query}`, () =>
      fetchImpl(overpassUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': ua },
        body: new URLSearchParams({ data: query }).toString(),
        signal: AbortSignal.timeout(70_000)
      })
    )

  function json(res, body) {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(body)
  }

  return {
    async handle(req, res, url, path) {
      if (req.method !== 'GET') throw new HttpError(405, 'Nicht erlaubt')
      const sub = path.slice('/api/routing'.length)

      if (sub === '/wanderwege') {
        const bbox = String(url.searchParams.get('bbox') ?? '').split(',').map(Number)
        const type = url.searchParams.get('typ') ?? 'hiking'
        if (bbox.length !== 4 || !bbox.every(Number.isFinite)) throw new HttpError(400, 'Ausschnitt fehlt.')
        const [w, s, e, n] = bbox.map((v) => Math.round(v * 1e5) / 1e5)
        if (w >= e || s >= n || Math.abs(s) > 85 || Math.abs(n) > 85) throw new HttpError(400, 'Ausschnitt ungültig.')
        if (e - w > MAX_SPAN || n - s > MAX_SPAN) throw new HttpError(400, 'Ausschnitt zu groß – bitte näher heranzoomen.')
        if (!TYPES[type]) throw new HttpError(400, 'Unbekannte Art.')
        const name = String(url.searchParams.get('name') ?? '').trim()
        const nameFilter = name ? `["name"~"${regexSafe(name)}",i]` : ''
        return json(res, await overpass(`[out:json][timeout:25];relation["type"="route"]["route"~"^(${TYPES[type]})$"]${nameFilter}(${s},${w},${n},${e});out tags 150;`))
      }

      const m = sub.match(/^\/wanderwege\/(\d{1,12})$/)
      if (m) return json(res, await overpass(`[out:json][timeout:60];relation(${m[1]});(._;rel(r););out geom;`))

      if (sub === '/strecke') {
        const lonlats = String(url.searchParams.get('lonlats') ?? '')
        const profile = String(url.searchParams.get('profile') ?? '')
        if (!LONLATS_RE.test(lonlats)) throw new HttpError(400, 'Wegpunkte ungültig (2 bis 16).')
        if (!PROFILES.has(profile)) throw new HttpError(400, 'Unbekanntes Profil.')
        const q = new URLSearchParams({ lonlats, profile, alternativeidx: '0', format: 'geojson' })
        const body = await upstream(`br:${q}`, () => fetchImpl(`${brouterUrl}?${q}`, { headers: { 'User-Agent': ua }, signal: AbortSignal.timeout(60_000) }))
        return json(res, body)
      }

      throw new HttpError(404, 'Unbekannte Adresse')
    }
  }
}
