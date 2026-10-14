/**
 * Unwetterwarnungen von MeteoAlarm (EUMETNET – amtliche Warnungen der nationalen Wetterdienste Europas)
 * über den eigenen Server. Die App braucht so keine fremde Adresse (kein CORS-Problem), und der Server kann
 * die Warnungen regelmäßig prüfen und als Push-Benachrichtigung schicken – auch wenn die App geschlossen ist.
 *
 * MeteoAlarm liefert je Land eine Liste von CAP-Warnungen. Die Gebiete sind meist nur als Name und Kennung
 * (EMMA_ID) angegeben, manchmal auch als Umriss. Welche Warnung „unsere“ ist, entscheidet:
 *   1. Kennung des Gebiets steht in der Liste der beobachteten Regionen (von Hand in der App gewählt)
 *   2. ein Ort der Reise (Unterkunft, Unternehmung, Wetter-Ort) liegt im Umriss des Gebiets
 *   3. der Name des Gebiets passt zu einem Ortsnamen der Reise (z. B. „Kreis Amberg-Sulzbach“ ~ „Landkreis Amberg-Sulzbach“)
 *   4. Bereich „ganzes Land“: jede Warnung im Land
 *
 *  POST /api/unwetter/pruefen     { country, scope?, points?, names?, regions? }  → aktuelle Warnungen im Land, passende markiert
 *  PUT  /api/unwetter/beobachten  { items: [{ trip, title, countries, from, to, scope, points, names, regions }] }
 *                                 ersetzt die Beobachtungsliste der Person (für die Push-Benachrichtigungen)
 */
import { HttpError, readJson, send } from './http.mjs'

/** ISO-Ländercode → Name des Feeds bei MeteoAlarm (feeds-<name>) */
export const COUNTRY_SLUGS = {
  AT: 'austria', BE: 'belgium', BA: 'bosnia-herzegovina', BG: 'bulgaria', HR: 'croatia', CY: 'cyprus', CZ: 'czechia',
  DK: 'denmark', EE: 'estonia', FI: 'finland', FR: 'france', DE: 'germany', GR: 'greece', HU: 'hungary', IS: 'iceland',
  IE: 'ireland', IL: 'israel', IT: 'italy', LV: 'latvia', LT: 'lithuania', LU: 'luxembourg', MT: 'malta', MD: 'moldova',
  ME: 'montenegro', NL: 'netherlands', MK: 'republic-of-north-macedonia', NO: 'norway', PL: 'poland', PT: 'portugal',
  RO: 'romania', RS: 'serbia', SK: 'slovakia', SI: 'slovenia', ES: 'spain', SE: 'sweden', CH: 'switzerland',
  UA: 'ukraine', GB: 'united-kingdom', UK: 'united-kingdom'
}

/** Warnart (MeteoAlarm „awareness_type“) → deutscher Name */
export const TYPE_NAMES = {
  1: 'Sturm', 2: 'Schnee und Glätte', 3: 'Gewitter', 4: 'Nebel', 5: 'Hitze', 6: 'Kälte', 7: 'Küstengefahren',
  8: 'Waldbrandgefahr', 9: 'Lawinen', 10: 'Starkregen', 11: 'Unwetter', 12: 'Hochwasser', 13: 'Regen und Hochwasser'
}

/** Warnstufe (2 gelb, 3 orange, 4 rot) */
export const LEVEL_NAMES = { 2: 'Gelb', 3: 'Orange', 4: 'Rot' }
const SEVERITY_LEVEL = { minor: 1, moderate: 2, severe: 3, extreme: 4 }

const FEED_MS = 10 * 60_000
const STALE_MS = 6 * 3600_000
const TICK_MS = 15 * 60_000
const KEEP_SENT_MS = 7 * 86400_000
const DAY_MS = 86400_000
const MAX_WATCH = 50
const MAX_POINTS = 200
const MAX_NAMES = 200
const MAX_REGIONS = 100

// ---------------------------------------------------------------- Feed lesen

const asArray = (v) => (Array.isArray(v) ? v : v == null ? [] : [v])
const str = (v, max = 4000) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const leadingNumber = (v) => {
  const n = parseInt(String(v ?? ''), 10)
  return Number.isFinite(n) ? n : 0
}

/** Info-Block in der passenden Sprache: Deutsch, sonst Englisch, sonst der erste */
function pickInfo(infos) {
  const lang = (i) => String(i?.language ?? '').toLowerCase().split('-')[0]
  return infos.find((i) => lang(i) === 'de') ?? infos.find((i) => lang(i) === 'en') ?? infos[0]
}

/** CAP-Umriss „lat,lon lat,lon …“ → [[lat, lon], …] */
export function parsePolygon(text) {
  const pts = String(text ?? '')
    .trim()
    .split(/\s+/)
    .map((p) => p.split(',').map(Number))
    .filter((p) => p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180)
    .map((p) => [p[0], p[1]])
  return pts.length >= 3 ? pts : null
}

/**
 * MeteoAlarm-Antwort (JSON) → aktuelle Warnungen ab Stufe Gelb.
 * @param {any} json  Antwort von /api/v1/warnings/feeds-<land>
 * @param {number} [now]
 */
export function parseFeed(json, now = Date.now()) {
  const out = new Map()
  for (const w of asArray(json?.warnings)) {
    const alert = w?.alert ?? w
    if (!alert || typeof alert !== 'object') continue
    if (String(alert.msgType ?? '').toLowerCase() === 'cancel') continue
    if (alert.status && String(alert.status).toLowerCase() !== 'actual') continue
    const infos = asArray(alert.info).filter((i) => i && typeof i === 'object')
    const info = pickInfo(infos)
    if (!info) continue
    const params = asArray(info.parameter)
    const param = (name) => params.find((p) => String(p?.valueName ?? '').toLowerCase() === name)?.value
    let level = leadingNumber(param('awareness_level'))
    if (!level) level = SEVERITY_LEVEL[String(info.severity ?? '').toLowerCase()] ?? 0
    if (level < 2) continue
    level = Math.min(4, level)
    const type = leadingNumber(param('awareness_type'))
    const expires = str(info.expires, 40)
    if (expires && Date.parse(expires) < now) continue
    const onset = str(info.onset, 40) || str(info.effective, 40) || str(alert.sent, 40)
    const areas = []
    for (const a of asArray(info.area)) {
      if (!a || typeof a !== 'object') continue
      const codes = []
      for (const g of asArray(a.geocode)) {
        const v = str(g?.value, 40)
        if (!v) continue
        // EMMA_ID zuerst – das ist die Kennung, die alle Länder haben
        if (String(g?.valueName ?? '').toUpperCase() === 'EMMA_ID') codes.unshift(v)
        else codes.push(v)
      }
      const polygons = asArray(a.polygon).map(parsePolygon).filter(Boolean)
      areas.push({ name: str(a.areaDesc, 200), codes: [...new Set(codes)].slice(0, 20), polygons })
    }
    if (!areas.length) continue
    const id = str(alert.identifier, 300) || str(w?.uuid, 300)
    if (!id) continue
    out.set(id, {
      id,
      level,
      type,
      typeName: TYPE_NAMES[type] ?? (str(info.event, 80) || 'Unwetter'),
      event: str(info.event, 200),
      headline: str(info.headline, 300),
      description: str(info.description, 4000),
      instruction: str(info.instruction, 4000),
      onset,
      expires,
      sender: str(info.senderName, 200),
      web: /^https:\/\//.test(str(info.web, 500)) ? str(info.web, 500) : '',
      areas
    })
  }
  return [...out.values()]
}

// ---------------------------------------------------------------- Zuordnen

/** Häufige Verwaltungswörter, die in Gebietsnamen stehen, aber nicht zum Ortsnamen gehören */
const ADMIN_WORDS = [
  'landkreis', 'stadtkreis', 'kreisfreie', 'kreis', 'stadt', 'bezirk', 'gemeinde', 'region', 'landesteil', 'kanton', 'canton',
  'regione', 'provincia', 'province', 'provincie', 'departement', 'county', 'district', 'comarca', 'comune', 'municipality',
  'di', 'de', 'del', 'della', 'du', 'des', 'la', 'le', 'of', 'the'
]
const ADMIN_RE = new RegExp(`\\b(${ADMIN_WORDS.join('|')})\\b`, 'g')

/** Gebiets- oder Ortsname vergleichbar machen: „Landkreis Amberg-Sulzbach“ → „ambergsulzbach“ */
export const normArea = (s) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(ADMIN_RE, ' ')
    .replace(/\s+/g, '')

/** Punkt [lat, lon] im Umriss (Strahl-Verfahren) */
export function inPolygon([lat, lon], poly) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ai, bi] = poly[i]
    const [aj, bj] = poly[j]
    if (bi > lon !== bj > lon && lat < ((aj - ai) * (lon - bi)) / (bj - bi) + ai) inside = !inside
  }
  return inside
}

function namesMatch(area, names) {
  const a = normArea(area)
  if (a.length < 3) return false
  return names.some((n) => n === a || (a.length >= 5 && n.length >= 5 && (a.includes(n) || n.includes(a))))
}

/**
 * Betrifft die Warnung die Reise?
 * @param {{ areas: { name: string, codes: string[], polygons: number[][][] }[] }} w
 * @param {{ scope?: string, points?: number[][], names?: string[], regions?: string[] }} watch  names schon mit normArea
 * @returns {{ how: 'region'|'ort'|'name'|'land', area: string } | null}
 */
export function matchWarning(w, watch) {
  const regions = new Set(watch.regions ?? [])
  const points = watch.points ?? []
  const names = watch.names ?? []
  for (const a of w.areas) if (a.codes.some((c) => regions.has(c))) return { how: 'region', area: a.name }
  for (const a of w.areas) if (a.polygons.length && points.some((p) => a.polygons.some((poly) => inPolygon(p, poly)))) return { how: 'ort', area: a.name }
  for (const a of w.areas) if (namesMatch(a.name, names)) return { how: 'name', area: a.name }
  if (watch.scope === 'land') return { how: 'land', area: w.areas.map((a) => a.name).filter(Boolean).slice(0, 3).join(', ') }
  return null
}

/** Beobachtung aus der Anfrage prüfen und begrenzen */
export function cleanWatch(body) {
  const scope = body?.scope === 'land' ? 'land' : body?.scope === 'aus' ? 'aus' : 'orte'
  const points = asArray(body?.points)
    .filter((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180)
    .slice(0, MAX_POINTS)
    .map((p) => [Number(p[0]), Number(p[1])])
  const names = [...new Set(asArray(body?.names).filter((n) => typeof n === 'string').map((n) => normArea(n.slice(0, 100))).filter((n) => n.length >= 3))].slice(0, MAX_NAMES)
  const regions = [...new Set(asArray(body?.regions).filter((r) => typeof r === 'string' && /^[A-Za-z0-9_.:-]{1,40}$/.test(r)))].slice(0, MAX_REGIONS)
  return { scope, points, names, regions }
}

// ---------------------------------------------------------------- Texte

/** Zeitzone je Land (Festland) – für den Text der Benachrichtigung in Ortszeit */
const TIME_ZONES = {
  PT: 'Europe/Lisbon', IE: 'Europe/Dublin', GB: 'Europe/London', UK: 'Europe/London', IS: 'Atlantic/Reykjavik',
  FI: 'Europe/Helsinki', EE: 'Europe/Tallinn', LV: 'Europe/Riga', LT: 'Europe/Vilnius', RO: 'Europe/Bucharest', BG: 'Europe/Sofia',
  GR: 'Europe/Athens', CY: 'Asia/Nicosia', UA: 'Europe/Kyiv', MD: 'Europe/Chisinau', IL: 'Asia/Jerusalem'
}
export const timeZoneOf = (country) => TIME_ZONES[country] ?? 'Europe/Berlin'

/** „Do 15.10. 14:00“ in der Zeitzone `timeZone` */
export function localWhen(iso, timeZone = 'Europe/Berlin') {
  const t = Date.parse(iso ?? '')
  if (!iso || Number.isNaN(t)) return ''
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone })
      .formatToParts(new Date(t))
      .map((x) => [x.type, x.value])
  )
  return `${String(p.weekday).replace('.', '')} ${p.day}.${p.month}. ${p.hour}:${p.minute}`
}

/** Zeitraum einer Warnung, z. B. „Do 15.10. 14:00 – Fr 16.10. 06:00“ (gleicher Tag: nur Uhrzeit) */
export function period(onset, expires, timeZone) {
  const a = localWhen(onset, timeZone)
  const b = localWhen(expires, timeZone)
  if (!a) return b ? `bis ${b}` : ''
  if (!b) return `ab ${a}`
  return a.slice(0, 9) === b.slice(0, 9) ? `${a} – ${b.slice(10)}` : `${a} – ${b}`
}

// ---------------------------------------------------------------- Dienst

/**
 * @param {ReturnType<import('./store.mjs').createStore>} store
 * @param {ReturnType<import('./benachrichtigungen.mjs').createBenachrichtigungen>} push
 * @param {{ url?: string, fetchImpl?: typeof fetch, version?: string, log?: (msg: string) => void }} [opts]
 */
export function createUnwetter(store, push, opts = {}) {
  const { db } = store
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const root = (opts.url || 'https://feeds.meteoalarm.org/api/v1/warnings').replace(/\/+$/, '')
  const ua = `KofferFertigRaus/${opts.version ?? '1'} (selbst gehosteter Reiseplaner)`
  const log = opts.log ?? ((m) => console.log(m))
  db.exec(`
    CREATE TABLE IF NOT EXISTS weather_watch (
      owner TEXT NOT NULL, trip TEXT NOT NULL, data TEXT NOT NULL, updated TEXT NOT NULL,
      PRIMARY KEY (owner, trip)
    );
    CREATE TABLE IF NOT EXISTS weather_sent (
      device_id TEXT NOT NULL, key TEXT NOT NULL, at TEXT NOT NULL,
      PRIMARY KEY (device_id, key)
    );
  `)
  const q = {
    clear: db.prepare('DELETE FROM weather_watch WHERE owner = ?'),
    add: db.prepare('INSERT OR REPLACE INTO weather_watch (owner, trip, data, updated) VALUES (?, ?, ?, ?)'),
    all: db.prepare('SELECT * FROM weather_watch'),
    count: db.prepare('SELECT COUNT(*) AS n FROM weather_watch WHERE owner = ?'),
    removeSpace: db.prepare("DELETE FROM weather_watch WHERE owner = ? OR owner LIKE ? || ':%'"),
    wasSent: db.prepare('SELECT 1 FROM weather_sent WHERE device_id = ? AND key = ?'),
    markSent: db.prepare('INSERT OR IGNORE INTO weather_sent (device_id, key, at) VALUES (?, ?, ?)'),
    purge: db.prepare('DELETE FROM weather_sent WHERE at < ?')
  }

  /** Land → { at, warnings } */
  const cache = new Map()

  /** Aktuelle Warnungen eines Landes (10 Minuten zwischengespeichert; bei Fehlern bis 6 Stunden alte) */
  async function warningsOf(country, now = Date.now()) {
    const slug = COUNTRY_SLUGS[country]
    if (!slug) throw new HttpError(404, 'Für dieses Land gibt es bei MeteoAlarm keine Warnungen.', { code: 'land' })
    const hit = cache.get(country)
    if (hit && now - hit.at < FEED_MS) return hit
    let res
    try {
      res = await fetchImpl(`${root}/feeds-${slug}`, { headers: { 'User-Agent': ua, Accept: 'application/json' }, signal: AbortSignal.timeout(20_000) })
    } catch {
      if (hit && now - hit.at < STALE_MS) return hit
      throw new HttpError(502, 'MeteoAlarm ist gerade nicht erreichbar.')
    }
    if (!res.ok) {
      if (hit && now - hit.at < STALE_MS) return hit
      throw new HttpError(502, `MeteoAlarm antwortet mit Fehler ${res.status}.`)
    }
    let json
    try {
      json = await res.json()
    } catch {
      if (hit && now - hit.at < STALE_MS) return hit
      throw new HttpError(502, 'Antwort von MeteoAlarm unlesbar.')
    }
    const entry = { at: now, warnings: parseFeed(json, now) }
    cache.set(country, entry)
    return entry
  }

  /** Für die App: ohne Umrisse (die braucht sie nicht), mit Zuordnung */
  const forApp = (w, match) => ({
    id: w.id, level: w.level, type: w.type, typeName: w.typeName, event: w.event, headline: w.headline, description: w.description,
    instruction: w.instruction, onset: w.onset, expires: w.expires, sender: w.sender, web: w.web,
    areas: w.areas.map((a) => ({ name: a.name, codes: a.codes })), match
  })

  async function check(country, watch, now = Date.now()) {
    const { at, warnings } = await warningsOf(country, now)
    const list = warnings
      .filter((w) => !w.expires || Date.parse(w.expires) > now)
      .map((w) => forApp(w, matchWarning(w, watch)))
      .sort((a, b) => Number(!!b.match) - Number(!!a.match) || b.level - a.level || String(a.onset).localeCompare(String(b.onset)))
    return { country, fetchedAt: new Date(at).toISOString(), warnings: list }
  }

  function setWatch(owner, items) {
    if (!Array.isArray(items)) throw new HttpError(400, 'items fehlt')
    if (items.length > MAX_WATCH) throw new HttpError(413, `Höchstens ${MAX_WATCH} Reisen.`)
    const date = /^\d{4}-\d{2}-\d{2}$/
    const rows = []
    for (const it of items) {
      if (typeof it?.trip !== 'string' || !it.trip || it.trip.length > 200) throw new HttpError(400, 'Reise fehlt')
      if (!date.test(it.from ?? '') || !date.test(it.to ?? '')) throw new HttpError(400, 'Reisezeitraum fehlt')
      const countries = [...new Set(asArray(it.countries).filter((c) => typeof c === 'string' && COUNTRY_SLUGS[c]))].slice(0, 10)
      const watch = cleanWatch(it)
      if (watch.scope === 'aus' || !countries.length) continue
      rows.push([it.trip, JSON.stringify({ title: str(it.title, 80) || 'Reise', countries, from: it.from, to: it.to, ...watch })])
    }
    const ts = new Date().toISOString()
    db.exec('BEGIN')
    try {
      q.clear.run(owner)
      for (const [trip, data] of rows) q.add.run(owner, trip, data, ts)
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
    return rows.length
  }

  /**
   * Beobachtete Reisen prüfen und neue Warnungen schicken.
   * Je Gerät, Reise, Warnart, Stufe und Tag höchstens eine Nachricht (Verlängerungen oder Neufassungen kommen nicht doppelt).
   */
  async function tick(at = Date.now()) {
    let sent = 0
    const today = new Date(at).toISOString().slice(0, 10)
    const day = (d, plus) => new Date(Date.parse(d) + plus * DAY_MS).toISOString().slice(0, 10)
    for (const row of q.all.all()) {
      let w
      try {
        w = JSON.parse(row.data)
      } catch {
        continue
      }
      // Ab dem Vortag bis zum Tag nach der Reise
      if (today < day(w.from, -1) || today > day(w.to, 1)) continue
      const targets = push.subsOfOwner(row.owner, 'unwetter')
      if (!targets.length) continue
      const tripStart = Date.parse(`${day(w.from, -1)}T00:00:00Z`)
      const tripEnd = Date.parse(`${day(w.to, 2)}T00:00:00Z`)
      for (const country of w.countries) {
        let warnings
        try {
          warnings = (await warningsOf(country, at)).warnings
        } catch (e) {
          log(`Unwetter ${country}: ${e?.message ?? e}`)
          continue
        }
        /** Gleiche Art, Stufe und Tag zusammenfassen (mehrere Gebiete einer Reise) */
        const groups = new Map()
        for (const x of warnings) {
          if (x.expires && Date.parse(x.expires) <= at) continue
          const start = Date.parse(x.onset || '') || at
          const end = Date.parse(x.expires || '') || start
          if (end < tripStart || start > tripEnd) continue
          const m = matchWarning(x, w)
          if (!m) continue
          const key = `${row.trip}|${country}|${x.type}|${x.level}|${String(x.onset).slice(0, 10)}`
          const g = groups.get(key)
          if (g) {
            if (m.area && !g.areas.includes(m.area)) g.areas.push(m.area)
          } else groups.set(key, { x, areas: m.area ? [m.area] : [] })
        }
        for (const [key, { x, areas }] of groups) {
          for (const s of targets) {
            if (x.level < s.prefs.unwetterStufe || q.wasSent.get(s.device_id, key)) continue
            q.markSent.run(s.device_id, key, new Date(at).toISOString())
            const place = areas.slice(0, 2).join(', ') + (areas.length > 2 ? ` und ${areas.length - 2} weitere` : '')
            const r = await push.deliver(s, {
              title: `${w.title}: ${LEVEL_NAMES[x.level]} – ${x.typeName}`,
              body: [place, period(x.onset, x.expires, timeZoneOf(country))].filter(Boolean).join(' · ').slice(0, 280),
              url: `#/trip/${row.trip}/unwetter`,
              tag: `unwetter:${row.trip}:${x.type}`.slice(0, 100)
            }, { ttl: 12 * 3600, urgency: x.level >= 3 ? 'high' : 'normal' })
            if (r.ok) sent++
          }
        }
      }
    }
    q.purge.run(new Date(at - KEEP_SENT_MS).toISOString())
    return sent
  }

  let running = false
  async function safeTick(at = Date.now()) {
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
    check,
    setWatch,
    /** Nur für Tests */
    clearCache: () => cache.clear(),

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
    },

    async handle(req, res, path, auth) {
      const { group, member } = auth
      const owner = member ? `${group.space}:${member.id}` : group.space
      if (path === '/api/unwetter/pruefen' && req.method === 'POST') {
        const body = await readJson(req, 128 * 1024)
        const country = String(body.country ?? '').toUpperCase()
        if (!/^[A-Z]{2}$/.test(country)) throw new HttpError(400, 'Land fehlt')
        return send(res, 200, await check(country, cleanWatch(body)))
      }
      if (path === '/api/unwetter/beobachten' && req.method === 'PUT') {
        const body = await readJson(req, 512 * 1024)
        return send(res, 200, { ok: true, beobachtet: setWatch(owner, body.items) })
      }
      if (path === '/api/unwetter' && req.method === 'GET') {
        return send(res, 200, { laender: Object.keys(COUNTRY_SLUGS).filter((c) => c !== 'UK'), beobachtet: q.count.get(owner).n })
      }
      throw new HttpError(404, 'Unbekannte Adresse')
    }
  }
}
