/**
 * Reise- und Sicherheitshinweise des Auswärtigen Amts (OpenData, frei nutzbar) über den eigenen Server.
 * Vorteile: kein CORS-Problem in der App, Zwischenspeicher (Länderliste 6 h, Länderseite 1 h),
 * und die App braucht nur den Ländercode – keine beliebigen Adressen.
 */
import { HttpError } from './http.mjs'

const LIST_MS = 6 * 3600_000
const DETAIL_MS = 3600_000

export function createReiseinfo(opts = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch
  const base = (opts.url || 'https://www.auswaertiges-amt.de/opendata/travelwarning').replace(/\/+$/, '')
  const ua = `NixWieWeg/${opts.version ?? '1'} (selbst gehosteter Reiseplaner)`
  /** @type {Map<string, { at: number, body: any }>} */
  const cache = new Map()

  async function get(url, maxAge) {
    const hit = cache.get(url)
    if (hit && Date.now() - hit.at < maxAge) return hit.body
    let res
    try {
      res = await fetchImpl(url, { headers: { 'User-Agent': ua, Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) })
    } catch {
      if (hit) return hit.body // lieber etwas ältere Hinweise als gar keine
      throw new HttpError(502, 'Auswärtiges Amt nicht erreichbar.')
    }
    if (!res.ok) {
      if (hit) return hit.body
      throw new HttpError(502, `Auswärtiges Amt antwortet mit Fehler ${res.status}.`)
    }
    let body
    try {
      body = await res.json()
    } catch {
      throw new HttpError(502, 'Antwort des Auswärtigen Amts unlesbar.')
    }
    if (cache.size > 300) cache.delete(cache.keys().next().value)
    cache.set(url, { at: Date.now(), body })
    return body
  }

  return {
    async handle(req, res, path) {
      if (req.method !== 'GET') throw new HttpError(405, 'Nicht erlaubt')
      const m = path.match(/^\/api\/reiseinfo\/([A-Z]{2})$/)
      if (!m) throw new HttpError(404, 'Unbekanntes Land')
      const list = await get(base, LIST_MS)
      const r = list?.response ?? {}
      const id = (r.contentList ?? []).find((k) => String(r[k]?.countryCode ?? '').toUpperCase() === m[1])
      if (!id || !/^\d{1,12}$/.test(String(id))) throw new HttpError(404, 'Für dieses Land gibt es keine Reisehinweise.')
      const detail = await get(`${base}/${id}`, DETAIL_MS)
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
      res.end(JSON.stringify(detail))
    }
  }
}
