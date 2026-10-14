/**
 * Unwetterwarnungen von MeteoAlarm (EUMETNET – die amtlichen Warnungen der nationalen Wetterdienste Europas).
 *
 *  - Feeds je Land (Atom, frei nutzbar) über den eigenen Server: kein CORS-Problem, zwischengespeichert (10 Minuten),
 *    die App schickt nur Koordinaten – keine beliebigen Adressen.
 *  - Ort → Warnregion (EMMA_ID) über die mitgelieferten Umrisse (daten/meteoalarm-regionen.json.gz, vereinfacht).
 *    Länder ohne Umrisse (z. B. Schweiz, Großbritannien): Warnungen des ganzen Landes ohne Ortszuordnung.
 *  - Text der Warnung (Deutsch, sonst Englisch) aus der CAP-Nachricht des Wetterdienstes, nur für passende Warnungen.
 *  - Push: Die App meldet die Orte der laufenden und kommenden Reisen (Unterkünfte, Wetter-Ort, Reiseziel);
 *    der Server prüft alle 10 Minuten und schickt neue Warnungen (Orange/Rot, auf Wunsch auch Gelb) je einmal.
 *
 *  GET /api/unwetter?orte=<lat>,<lon>;…&laender=AT,CH   Warnungen für die Orte (höchstens 20) bzw. Länder
 *  GET /api/unwetter/beobachten                           Anzahl gemeldeter Orte dieser Person
 *  PUT /api/unwetter/beobachten  { orte: [{ reise, titel, name, lat, lon, von, bis }], zeitzone }
 */
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { HttpError, readJson, send } from './http.mjs'

/** ISO-Ländercode → Name des Feeds bei MeteoAlarm */
export const FEEDS = {
  AT: 'austria', BA: 'bosnia-herzegovina', BE: 'belgium', BG: 'bulgaria', CH: 'switzerland', CY: 'cyprus', CZ: 'czechia',
  DE: 'germany', DK: 'denmark', EE: 'estonia', ES: 'spain', FI: 'finland', FR: 'france', GB: 'united-kingdom',
  GR: 'greece', HR: 'croatia', HU: 'hungary', IE: 'ireland', IL: 'israel', IS: 'iceland', IT: 'italy', LT: 'lithuania',
  LU: 'luxembourg', LV: 'latvia', MD: 'moldova', ME: 'montenegro', MK: 'republic-of-north-macedonia', MT: 'malta',
  NL: 'netherlands', NO: 'norway', PL: 'poland', PT: 'portugal', RO: 'romania', RS: 'serbia', SE: 'sweden',
  SI: 'slovenia', SK: 'slovakia', UA: 'ukraine'
}

/** Art der Warnung (aus „awareness_type“ bzw. dem Titel) → Schlüssel und deutscher Name */
export const ARTEN = {
  wind: 'Sturm', schnee: 'Schnee/Glätte', gewitter: 'Gewitter', nebel: 'Nebel', hitze: 'Hitze', kaelte: 'Kälte',
  kueste: 'Sturmflut/Küste', waldbrand: 'Waldbrand', lawinen: 'Lawinen', regen: 'Starkregen', hochwasser: 'Hochwasser',
  sonstiges: 'Unwetter'
}
const ART_NAMEN = {
  wind: 'wind', snowice: 'schnee', snow: 'schnee', ice: 'schnee', thunderstorm: 'gewitter', thunderstorms: 'gewitter',
  fog: 'nebel', hightemperature: 'hitze', extremehighttemperature: 'hitze', lowtemperature: 'kaelte',
  extremelowtemperature: 'kaelte', coastalevent: 'kueste', forestfire: 'waldbrand', avalanche: 'lawinen',
  avalanches: 'lawinen', rain: 'regen', flooding: 'hochwasser', flood: 'hochwasser', rainflood: 'hochwasser'
}
/** Nummern von „awareness_type“ (MeteoAlarm) */
const ART_NUMMERN = { 1: 'wind', 2: 'schnee', 3: 'gewitter', 4: 'nebel', 5: 'hitze', 6: 'kaelte', 7: 'kueste', 8: 'waldbrand', 9: 'lawinen', 10: 'regen', 12: 'hochwasser', 13: 'hochwasser' }
export const STUFEN = { 1: 'Grün', 2: 'Gelb', 3: 'Orange', 4: 'Rot' }
const FARBEN = { green: 1, yellow: 2, orange: 3, red: 4 }
const SEVERITY = { minor: 1, moderate: 2, severe: 3, extreme: 4 }

const FEED_MS = 10 * 60_000
const CAP_MS = 6 * 3600_000
const MAX_ORTE = 20
const MAX_DETAILS = 30
const MAX_WATCH = 100
const TICK_MS = 10 * 60_000
const KEEP_SENT_MS = 7 * 86400_000
/** Push nur für Warnungen, die innerhalb der nächsten 36 Stunden beginnen (oder schon laufen) */
const AHEAD_MS = 36 * 3600_000

// ---------------------------------------------------------------- Regionen

/** Namen vergleichbar machen („Kärnten“ ~ „Karnten“) */
export const normName = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]/g, '')

/**
 * Warnregionen laden: { id, land, name, rings, box }
 * @param {string|URL} [file]
 */
export function loadRegions(file = new URL('./daten/meteoalarm-regionen.json.gz', import.meta.url)) {
  const raw = JSON.parse(gunzipSync(readFileSync(file)).toString('utf8'))
  const list = []
  for (const [id, [land, name, rings]] of Object.entries(raw)) {
    const box = [Infinity, Infinity, -Infinity, -Infinity]
    for (const r of rings)
      for (let i = 0; i < r.length; i += 2) {
        box[0] = Math.min(box[0], r[i])
        box[1] = Math.min(box[1], r[i + 1])
        box[2] = Math.max(box[2], r[i])
        box[3] = Math.max(box[3], r[i + 1])
      }
    list.push({ id, land, name, rings, box })
  }
  return list
}

/** Liegt der Punkt in den Ringen (Gerade-Ungerade-Regel – Löcher und mehrere Teile zählen richtig)? */
export function inRings(rings, lon, lat) {
  let inside = false
  for (const r of rings) {
    for (let i = 0, j = r.length - 2; i < r.length; j = i, i += 2) {
      const xi = r[i]
      const yi = r[i + 1]
      const xj = r[j]
      const yj = r[j + 1]
      if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
    }
  }
  return inside
}

/** Alle Warnregionen, in denen der Ort liegt (oft Bundesland und Bezirk) */
export function regionsAt(regions, lat, lon) {
  return regions.filter((g) => lon >= g.box[0] && lon <= g.box[2] && lat >= g.box[1] && lat <= g.box[3] && inRings(g.rings, lon, lat))
}

// ---------------------------------------------------------------- XML (nur das Nötige, ohne Pakete)

const unescapeXml = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, '&')
    .trim()

/** Inhalt des ersten Elements `name` (mit oder ohne Präfix) */
function tag(xml, name) {
  const m = xml.match(new RegExp(`<(?:[\\w-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`))
  return m ? unescapeXml(m[1]) : ''
}
function blocks(xml, name) {
  return [...xml.matchAll(new RegExp(`<(?:[\\w-]+:)?${name}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${name}>`, 'g'))].map((m) => m[1])
}
const attr = (el, name) => {
  const m = el.match(new RegExp(`\\s${name}="([^"]*)"`))
  return m ? unescapeXml(m[1]) : ''
}

const artAusName = (s) => ART_NAMEN[normName(s)] ?? null

/**
 * Atom-Feed eines Landes lesen. Jeder Eintrag ist eine Warnung für eine Region.
 * @returns {{ id: string, emma: string, codes: string[], area: string, event: string, level: number, art: string,
 *   onset: string, expires: string, identifier: string, capUrl: string, cancel: boolean }[]}
 */
export function parseFeed(xml) {
  const out = []
  for (const e of blocks(String(xml), 'entry')) {
    const links = [...e.matchAll(/<link\b[^>]*>/g)].map((m) => m[0])
    const capUrl = attr(links.find((l) => /application\/cap\+xml/.test(l)) ?? '', 'href')
    const codes = blocks(e, 'geocode').map((g) => `${tag(g, 'valueName')}:${tag(g, 'value')}`)
    // EMMA_ID steht als geocode oder im Link zur Region (https://meteoalarm.org?geocode=EMMA_ID:FR035)
    const emma = (codes.find((c) => c.startsWith('EMMA_ID:')) ?? links.map((l) => attr(l, 'href')).find((h) => /geocode=EMMA_ID:/.test(h)) ?? '').replace(/^.*EMMA_ID:/, '').trim()
    const title = tag(e, 'title')
    const t = title.match(/^(green|yellow|orange|red)\s+(.+?)\s+warning\b/i)
    const level = (t && FARBEN[t[1].toLowerCase()]) || SEVERITY[tag(e, 'severity').toLowerCase()] || 0
    out.push({
      id: tag(e, 'id'),
      emma,
      codes,
      area: tag(e, 'areaDesc'),
      event: tag(e, 'event'),
      level,
      art: (t && artAusName(t[2])) || 'sonstiges',
      onset: tag(e, 'onset') || tag(e, 'effective'),
      expires: tag(e, 'expires'),
      identifier: tag(e, 'identifier'),
      capUrl,
      cancel: /^cancel$/i.test(tag(e, 'message_type')) || (tag(e, 'status') !== '' && !/^actual$/i.test(tag(e, 'status')))
    })
  }
  return out
}

/** Sprache wählen: Deutsch, sonst Englisch, sonst die erste */
const pickInfo = (infos) => infos.find((i) => /^de/i.test(i.language)) ?? infos.find((i) => /^en/i.test(i.language)) ?? infos[0]

/**
 * CAP-Nachricht eines Wetterdienstes lesen (Text in der passenden Sprache, Stufe, Art).
 * @returns {{ event: string, headline: string, description: string, instruction: string, web: string, sender: string,
 *   level: number, art: string|null, onset: string, expires: string, language: string } | null}
 */
export function parseCap(xml) {
  const infos = blocks(String(xml), 'info').map((i) => {
    const params = Object.fromEntries(blocks(i, 'parameter').map((p) => [tag(p, 'valueName'), tag(p, 'value')]))
    const level = Number(String(params.awareness_level ?? '').split(';')[0]) || SEVERITY[tag(i, 'severity').toLowerCase()] || 0
    const typeNo = Number(String(params.awareness_type ?? '').split(';')[0])
    return {
      language: tag(i, 'language'),
      event: tag(i, 'event'),
      headline: tag(i, 'headline'),
      description: tag(i, 'description'),
      instruction: tag(i, 'instruction'),
      web: tag(i, 'web'),
      sender: tag(i, 'senderName'),
      level,
      art: ART_NUMMERN[typeNo] ?? artAusName(String(params.awareness_type ?? '').split(';')[1] ?? '') ?? null,
      onset: tag(i, 'onset') || tag(i, 'effective'),
      expires: tag(i, 'expires')
    }
  })
  return infos.length ? pickInfo(infos) : null
}

const httpsOnly = (u) => /^https?:\/\/[^\s]+$/.test(u) ? u : ''

// ---------------------------------------------------------------- Dienst

/**
 * @param {{ url?: string, fetchImpl?: typeof fetch, version?: string, regionsFile?: string|URL, log?: (m: string) => void }} [opts]
 */
export function createUnwetterQuelle(opts = {}) {
  const fetchImpl = opts.fetchImpl ?? fetch
  const root = (opts.url || 'https://feeds.meteoalarm.org/feeds').replace(/\/+$/, '')
  const origin = new URL(root).origin
  const ua = `NixWieWeg/${opts.version ?? '1'} (selbst gehosteter Reiseplaner)`
  const regions = loadRegions(opts.regionsFile)
  const withData = new Set(regions.map((r) => r.land))
  /** @type {Map<string, { at: number, body: any }>} */
  const cache = new Map()

  async function get(url, maxAge, parse, what) {
    const hit = cache.get(url)
    if (hit && Date.now() - hit.at < maxAge) return hit.body
    let res
    try {
      res = await fetchImpl(url, { headers: { 'User-Agent': ua, Accept: 'application/atom+xml, application/xml, text/xml' }, redirect: 'error', signal: AbortSignal.timeout(30_000) })
    } catch {
      if (hit) return hit.body // lieber etwas ältere Warnungen als gar keine
      throw new HttpError(502, `${what}: MeteoAlarm nicht erreichbar.`)
    }
    if (!res.ok) {
      if (hit) return hit.body
      throw new HttpError(502, `${what}: MeteoAlarm antwortet mit Fehler ${res.status}.`)
    }
    const body = parse(await res.text())
    if (cache.size > 400) cache.delete(cache.keys().next().value)
    cache.set(url, { at: Date.now(), body })
    return body
  }

  const feed = (land) => get(`${root}/meteoalarm-legacy-atom-${FEEDS[land]}`, FEED_MS, parseFeed, land)
  const cap = (url) => (url.startsWith(`${origin}/`) ? get(url, CAP_MS, parseCap, 'Warnung').catch(() => null) : Promise.resolve(null))

  /**
   * Warnungen für Orte und Länder.
   * @param {{ lat: number, lon: number }[]} orte
   * @param {string[]} [laender]  Zielländer der Reise – ohne Umrisse dort: alle Warnungen des Landes (ohne Ort)
   */
  async function warnungen(orte, laender = [], now = Date.now()) {
    const ortRegionen = orte.map((o) => regionsAt(regions, o.lat, o.lon))
    const fromPoints = new Set(ortRegionen.flat().map((r) => r.land))
    const ortlos = new Set(laender.filter((l) => FEEDS[l] && !withData.has(l)))
    const lands = [...new Set([...fromPoints, ...ortlos])].filter((l) => FEEDS[l])
    const fehler = []
    /** key → Warnung */
    const found = new Map()
    for (const land of lands) {
      let entries
      try {
        entries = await feed(land)
      } catch (e) {
        fehler.push(e.message)
        continue
      }
      const nameToRegions = new Map()
      ortRegionen.forEach((list, i) => list.filter((r) => r.land === land).forEach((r) => {
        const k = normName(r.name)
        if (!nameToRegions.has(k)) nameToRegions.set(k, [])
        nameToRegions.get(k).push({ r, i })
      }))
      for (const e of entries) {
        if (e.cancel || e.level < 2 || (e.expires && Date.parse(e.expires) < now)) continue
        let hits = []
        if (fromPoints.has(land)) {
          ortRegionen.forEach((list, i) => list.forEach((r) => {
            if (r.id === e.emma) hits.push({ r, i })
          }))
          // Unbekannte Region (neuer als unsere Umrisse): über den Namen
          if (!hits.length && (!e.emma || !regions.some((r) => r.id === e.emma))) hits = nameToRegions.get(normName(e.area)) ?? []
        }
        if (!hits.length && !ortlos.has(land)) continue
        const key = `${e.capUrl || e.identifier}|${e.art}|${e.level}`
        let w = found.get(key)
        if (!w) {
          w = { key, land, stufe: e.level, art: e.art, ereignis: '', beginn: e.onset, ende: e.expires, capUrl: e.capUrl, regionen: [], bereiche: [], orte: new Set(), ortlos: !hits.length }
          found.set(key, w)
        }
        for (const h of hits) {
          w.orte.add(h.i)
          if (!w.regionen.some((r) => r.id === h.r.id)) w.regionen.push({ id: h.r.id, name: h.r.name })
        }
        if (hits.length) w.ortlos = false
        if (e.area && !w.bereiche.includes(e.area)) w.bereiche.push(e.area)
      }
    }
    const list = [...found.values()].sort((a, b) => Number(a.ortlos) - Number(b.ortlos) || b.stufe - a.stufe || String(a.beginn).localeCompare(String(b.beginn)))
    // Text in Deutsch (oder Englisch) aus der Nachricht des Wetterdienstes
    for (const w of list.slice(0, MAX_DETAILS)) {
      const c = w.capUrl ? await cap(w.capUrl) : null
      if (!c) continue
      if (c.art && w.art === 'sonstiges') w.art = c.art
      w.ereignis = c.event || w.ereignis
      w.titel = c.headline
      w.text = c.description
      w.hinweis = c.instruction
      w.quelle = c.sender
      w.web = httpsOnly(c.web)
      w.sprache = c.language
    }
    return {
      stand: new Date(now).toISOString(),
      orte: ortRegionen.map((list) => ({ regionen: list.map((r) => ({ id: r.id, name: r.name, land: r.land })) })),
      warnungen: list.map(({ capUrl, orte: o, key, ...w }) => ({
        id: key,
        ...w,
        artName: ARTEN[w.art] ?? ARTEN.sonstiges,
        stufeName: STUFEN[w.stufe],
        orte: [...o].sort((a, b) => a - b),
        bereiche: w.bereiche.slice(0, 40)
      })),
      ohneDaten: laender.filter((l) => !FEEDS[l]),
      fehler
    }
  }

  return { warnungen, regions, feed }
}

/** „Di 14:00 – Mi 02:00“ in der Zeitzone des Geräts */
export function zeitraum(beginn, ende, zeitzone = 'Europe/Berlin', now = Date.now()) {
  let fmt
  try {
    fmt = new Intl.DateTimeFormat('de-DE', { timeZone: zeitzone, weekday: 'short', hour: '2-digit', minute: '2-digit' })
  } catch {
    fmt = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', weekday: 'short', hour: '2-digit', minute: '2-digit' })
  }
  const f = (iso) => fmt.format(new Date(iso)).replace(',', '')
  const b = Date.parse(beginn)
  const from = !Number.isNaN(b) && b > now ? f(beginn) : 'jetzt'
  return ende ? `${from} – ${f(ende)}` : `ab ${from}`
}

/**
 * Beobachten und Push: Orte je Person, neue Warnungen je einmal an ihre Geräte.
 * @param {ReturnType<import('./store.mjs').createStore>} store
 * @param {ReturnType<typeof createUnwetterQuelle>} quelle
 * @param {ReturnType<import('./benachrichtigungen.mjs').createBenachrichtigungen>} push
 */
export function createUnwetter(store, quelle, push, opts = {}) {
  const { db } = store
  const log = opts.log ?? ((m) => console.log(m))
  db.exec(`
    CREATE TABLE IF NOT EXISTS unwetter_watch (owner TEXT PRIMARY KEY, data TEXT NOT NULL, updated TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS unwetter_sent (owner TEXT NOT NULL, key TEXT NOT NULL, sent TEXT NOT NULL, PRIMARY KEY (owner, key));
  `)
  const q = {
    get: db.prepare('SELECT * FROM unwetter_watch WHERE owner = ?'),
    all: db.prepare('SELECT * FROM unwetter_watch'),
    put: db.prepare('INSERT INTO unwetter_watch (owner, data, updated) VALUES (?, ?, ?) ON CONFLICT (owner) DO UPDATE SET data = excluded.data, updated = excluded.updated'),
    remove: db.prepare('DELETE FROM unwetter_watch WHERE owner = ?'),
    removeSpace: db.prepare("DELETE FROM unwetter_watch WHERE owner = ? OR owner LIKE ? || ':%'"),
    removeSpaceSent: db.prepare("DELETE FROM unwetter_sent WHERE owner = ? OR owner LIKE ? || ':%'"),
    wasSent: db.prepare('SELECT 1 FROM unwetter_sent WHERE owner = ? AND key = ?'),
    markSent: db.prepare('INSERT OR IGNORE INTO unwetter_sent (owner, key, sent) VALUES (?, ?, ?)'),
    purge: db.prepare('DELETE FROM unwetter_sent WHERE sent < ?')
  }
  const ownerOf = (space, memberId) => (memberId ? `${space}:${memberId}` : space)
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

  function cleanWatch(body) {
    const orte = body?.orte
    if (!Array.isArray(orte)) throw new HttpError(400, 'orte fehlt')
    if (orte.length > MAX_WATCH) throw new HttpError(413, `Höchstens ${MAX_WATCH} Orte.`)
    const clean = orte.map((o) => {
      const lat = Number(o?.lat)
      const lon = Number(o?.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) throw new HttpError(400, 'Ungültiger Ort')
      if (!DATE_RE.test(o.von ?? '') || !DATE_RE.test(o.bis ?? '')) throw new HttpError(400, 'Ungültiger Zeitraum')
      return {
        reise: /^[\w-]{1,100}$/.test(o.reise ?? '') ? o.reise : '',
        titel: String(o.titel ?? '').slice(0, 80),
        name: String(o.name ?? '').slice(0, 80),
        lat: Math.round(lat * 1e4) / 1e4,
        lon: Math.round(lon * 1e4) / 1e4,
        von: o.von,
        bis: o.bis
      }
    })
    let zeitzone = typeof body.zeitzone === 'string' ? body.zeitzone.slice(0, 60) : 'Europe/Berlin'
    try {
      new Intl.DateTimeFormat('de-DE', { timeZone: zeitzone })
    } catch {
      zeitzone = 'Europe/Berlin'
    }
    return { orte: clean, zeitzone }
  }

  /** Datum (YYYY-MM-DD) in der Zeitzone, verschoben um `days` */
  const dayIn = (at, zeitzone, days = 0) => new Intl.DateTimeFormat('sv-SE', { timeZone: zeitzone }).format(new Date(at + days * 86400_000))

  async function tick(at = Date.now()) {
    let sent = 0
    for (const row of q.all.all()) {
      const watch = JSON.parse(row.data)
      // Ab dem Tag vor der Anreise bis zur Abreise
      const tomorrow = dayIn(at, watch.zeitzone, 1)
      const today = dayIn(at, watch.zeitzone)
      const active = watch.orte.filter((o) => o.von <= tomorrow && o.bis >= today)
      if (!active.length) continue
      const [space, memberId] = row.owner.split(':')
      const subs = push.subsFor(space, memberId ?? null, 'unwetter')
      if (!subs.length) continue
      let res
      try {
        res = await quelle.warnungen(active, [], at)
      } catch (e) {
        log(`Unwetter: ${e?.message ?? e}`)
        continue
      }
      for (const w of res.warnungen) {
        if (w.ortlos || !w.orte.length) continue
        if (w.beginn && Date.parse(w.beginn) - at > AHEAD_MS) continue
        const key = `${w.art}|${w.stufe}|${String(w.beginn).slice(0, 10)}|${w.regionen.map((r) => r.id).sort().join(',')}`
        if (q.wasSent.get(row.owner, key)) continue
        q.markSent.run(row.owner, key, new Date(at).toISOString())
        const ort = active[w.orte[0]]
        const regionen = w.regionen.map((r) => r.name).slice(0, 3).join(', ')
        const message = {
          title: `⚠️ Warnstufe ${STUFEN[w.stufe]}: ${w.artName}`,
          body: [`${regionen} · ${zeitraum(w.beginn, w.ende, watch.zeitzone, at)}`, ort?.titel ? `Reise: ${ort.titel}` : '', w.titel && w.titel !== w.ereignis ? w.titel : ''].filter(Boolean).join('\n').slice(0, 300),
          url: ort?.reise ? `#/trip/${ort.reise}/unwetter` : '#/',
          tag: `unwetter:${key}`.slice(0, 100)
        }
        const ttl = Math.max(600, Math.min(48 * 3600, Math.round(((Date.parse(w.ende) || at + 6 * 3600_000) - at) / 1000)))
        for (const s of subs) {
          if (w.stufe < 3 && !s.prefs.unwetterGelb) continue
          const r = await push.deliver(s, message, { ttl, urgency: w.stufe >= 3 ? 'high' : 'normal' })
          if (r.ok) sent++
        }
      }
    }
    q.purge.run(new Date(at - KEEP_SENT_MS).toISOString())
    return sent
  }

  let running = false
  async function safeTick(at) {
    if (running) return 0
    running = true
    try {
      return await tick(at)
    } catch (e) {
      log(`Unwetter: ${e?.message ?? e}`)
      return 0
    } finally {
      running = false
    }
  }
  let timer = null

  return {
    tick: safeTick,
    start() {
      if (!timer) timer = setInterval(() => void safeTick(), TICK_MS)
      timer.unref?.()
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },
    removeSpace(space) {
      q.removeSpace.run(space, space)
      q.removeSpaceSent.run(space, space)
    },

    async handle(req, res, url, path, auth) {
      const owner = ownerOf(auth.group.space, auth.member?.id ?? null)
      if (path === '/api/unwetter' && req.method === 'GET') {
        const orte = (url.searchParams.get('orte') ?? '')
          .split(';')
          .filter(Boolean)
          .map((p) => p.split(',').map(Number))
          .map(([lat, lon]) => ({ lat, lon }))
        if (orte.length > MAX_ORTE) throw new HttpError(400, `Höchstens ${MAX_ORTE} Orte.`)
        if (orte.some((o) => !Number.isFinite(o.lat) || !Number.isFinite(o.lon) || Math.abs(o.lat) > 90 || Math.abs(o.lon) > 180)) throw new HttpError(400, 'Ungültiger Ort')
        const laender = (url.searchParams.get('laender') ?? '').split(',').filter((l) => /^[A-Z]{2}$/.test(l)).slice(0, 20)
        return send(res, 200, await quelle.warnungen(orte, laender))
      }
      if (path === '/api/unwetter/beobachten' && req.method === 'GET') {
        const row = q.get.get(owner)
        return send(res, 200, { orte: row ? JSON.parse(row.data).orte.length : 0, aktualisiert: row?.updated ?? null })
      }
      if (path === '/api/unwetter/beobachten' && req.method === 'PUT') {
        const watch = cleanWatch(await readJson(req, 256 * 1024))
        if (watch.orte.length) q.put.run(owner, JSON.stringify(watch), new Date().toISOString())
        else q.remove.run(owner)
        return send(res, 200, { ok: true, orte: watch.orte.length })
      }
      throw new HttpError(404, 'Unbekannte Adresse')
    }
  }
}
