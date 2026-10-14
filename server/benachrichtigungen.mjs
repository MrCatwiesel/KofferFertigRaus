/**
 * Push-Benachrichtigungen (Web Push) – ohne Fremdpakete, nur node:crypto.
 *
 *  - VAPID (RFC 8292): Der Server erzeugt beim ersten Start ein eigenes Schlüsselpaar (P-256) und weist sich damit
 *    beim Push-Dienst (Apple, Google, Mozilla) aus. Nichts einzurichten.
 *  - Verschlüsselung (RFC 8291, aes128gcm): Nur das Gerät kann den Inhalt lesen, der Push-Dienst nicht.
 *  - Abo je Gerät, Zeitplan je Person: Die App lädt die anstehenden Erinnerungen (Fristen, Termine) hoch,
 *    der Server schickt sie zur passenden Zeit an alle Geräte dieser Person mit eingeschalteten Erinnerungen.
 *  - Änderungen anderer: neue Tagebucheinträge, Fotos, Unternehmungen … gebündelt (höchstens alle 15 Minuten je Reise).
 *  - Unwetterwarnungen: schickt unwetter.mjs über `subsOfOwner` und `deliver`.
 *
 *  GET    /api/benachrichtigungen            Schlüssel des Servers, Abo dieses Geräts, Anzahl geplanter Erinnerungen
 *  PUT    /api/benachrichtigungen/abo        { endpoint, keys: { p256dh, auth }, prefs? }   Abo dieses Geräts anlegen/ersetzen
 *  PATCH  /api/benachrichtigungen/abo        { prefs: { erinnerungen?, aenderungen?, unwetter?, unwetterStufe? } }
 *  DELETE /api/benachrichtigungen/abo
 *  POST   /api/benachrichtigungen/test       Testnachricht an dieses Gerät
 *  PUT    /api/benachrichtigungen/zeitplan   { items: [{ id, at, title, body?, url? }] }  ersetzt den Zeitplan der Person
 */
import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign } from 'node:crypto'
import { HttpError, readJson, send } from './http.mjs'
import { tripOf } from './members.mjs'

/** Push-Dienste der Browser – an andere Adressen schickt der Server nichts (kein Weiterleiten ins Heimnetz). */
export const PUSH_HOSTS = [/^([a-z0-9-]+\.)*push\.apple\.com$/, /^fcm\.googleapis\.com$/, /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/, /^([a-z0-9-]+\.)*notify\.windows\.com$/]
const B64URL_RE = /^[A-Za-z0-9_-]+={0,2}$/
const MAX_ITEMS = 500
const KEEP_SENT_MS = 3 * 86400_000
/** Erinnerungen, die (z. B. wegen eines Neustarts) bis zu 6 Stunden zu spät dran sind, gehen noch raus */
const LATE_MS = 6 * 3600_000
const TICK_MS = 60_000
/** Änderungen anderer: erst sammeln, dann höchstens alle 15 Minuten je Gerät und Reise */
const COLLECT_MS = 3 * 60_000
const COOLDOWN_MS = 15 * 60_000

/** Was bei „Änderungen anderer“ zählt (Tabelle → Artikel, Einzahl, Mehrzahl) – Packliste nicht (wird ständig abgehakt) */
export const CHANGE_LABELS = {
  journalEntries: ['ein', 'Tagebucheintrag', 'Tagebucheinträge'],
  photos: ['ein', 'Foto', 'Fotos'],
  voiceNotes: ['eine', 'Sprachnotiz', 'Sprachnotizen'],
  activities: ['eine', 'Unternehmung', 'Unternehmungen'],
  routes: ['eine', 'Route', 'Routen'],
  accommodations: ['eine', 'Unterkunft', 'Unterkünfte'],
  travelLegs: ['ein', 'Reiseabschnitt', 'Reiseabschnitte'],
  expenses: ['eine', 'Ausgabe', 'Ausgaben'],
  places: ['ein', 'Ort', 'Orte'],
  documents: ['ein', 'Dokument', 'Dokumente']
}

/** unwetterStufe: ab welcher Warnstufe (2 gelb, 3 orange, 4 rot) eine Unwetterwarnung kommt */
export const DEFAULT_PREFS = { erinnerungen: true, aenderungen: false, unwetter: true, unwetterStufe: 3 }

const b64u = (buf) => Buffer.from(buf).toString('base64url')
const fromB64u = (s) => Buffer.from(String(s), 'base64url')
const hmac = (key, data) => createHmac('sha256', key).update(data).digest()

// ---------------------------------------------------------------- Verschlüsselung (RFC 8291)

/**
 * Inhalt für ein Gerät verschlüsseln (Content-Encoding aes128gcm, ein Datensatz).
 * @param {Buffer|string} payload
 * @param {{ p256dh: string, auth: string }} keys  aus dem Abo des Browsers
 * @param {{ asPrivate?: Buffer, salt?: Buffer }} [fixed]  nur für Tests (Werte aus dem RFC)
 */
export function encryptPayload(payload, keys, fixed = {}) {
  const uaPublic = fromB64u(keys.p256dh)
  const authSecret = fromB64u(keys.auth)
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new HttpError(400, 'Ungültiger Geräteschlüssel (p256dh).')
  if (authSecret.length !== 16) throw new HttpError(400, 'Ungültiges Geheimnis (auth).')
  const ecdh = createECDH('prime256v1')
  if (fixed.asPrivate) ecdh.setPrivateKey(fixed.asPrivate)
  else ecdh.generateKeys()
  const asPublic = ecdh.getPublicKey()
  const shared = ecdh.computeSecret(uaPublic)
  const salt = fixed.salt ?? randomBytes(16)

  // HKDF mit SHA-256 (je nur ein Block nötig)
  const prkKey = hmac(authSecret, shared)
  const ikm = hmac(prkKey, Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]))
  const prk = hmac(salt, ikm)
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16)
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12)

  const data = Buffer.concat([Buffer.from(payload), Buffer.from([2])]) // 0x02 = letzter Datensatz, ohne Auffüllen
  const rs = 4096
  if (data.length + 16 > rs) throw new HttpError(413, 'Nachricht zu lang.')
  const cipher = createCipheriv('aes-128-gcm', cek, nonce)
  const body = Buffer.concat([cipher.update(data), cipher.final(), cipher.getAuthTag()])
  const header = Buffer.alloc(21)
  salt.copy(header, 0)
  header.writeUInt32BE(rs, 16)
  header[20] = asPublic.length
  return Buffer.concat([header, asPublic, body])
}

// ---------------------------------------------------------------- VAPID (RFC 8292)

/** Signiertes Token für den Push-Dienst (ES256, 12 Stunden gültig). */
export function vapidAuth(endpoint, vapid, subject, now = Date.now()) {
  const aud = new URL(endpoint).origin
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  const claims = b64u(JSON.stringify({ aud, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject }))
  const sig = sign('sha256', Buffer.from(`${head}.${claims}`), { key: vapid.privateKey, dsaEncoding: 'ieee-p1363' })
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${vapid.publicKey}`
}

/** Schlüssel aus dem JWK (wie gespeichert) */
export function vapidFromJwk(jwk) {
  const privateKey = createPrivateKey({ key: jwk, format: 'jwk' })
  const publicKey = b64u(Buffer.concat([Buffer.from([4]), fromB64u(jwk.x), fromB64u(jwk.y)]))
  return { privateKey, publicKey }
}

function newVapidJwk() {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const pub = ecdh.getPublicKey()
  return { kty: 'EC', crv: 'P-256', d: b64u(ecdh.getPrivateKey()), x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }
}

/** Adresse eines Push-Dienstes? (https, bekannter Anbieter) */
export function validEndpoint(endpoint, hosts = PUSH_HOSTS) {
  let u
  try {
    u = new URL(String(endpoint ?? ''))
  } catch {
    return false
  }
  if (u.protocol !== 'https:' || u.username || u.password || String(endpoint).length > 1000) return false
  return hosts.some((h) => (typeof h === 'string' ? h === u.hostname : h.test(u.hostname)))
}

// ---------------------------------------------------------------- Texte

/** Zusammenfassung der gesammelten Änderungen, z. B. „2 Tagebucheinträge, 5 Fotos“ */
export function changeSummary(counts) {
  const parts = []
  for (const [tbl, [article, one, many]] of Object.entries(CHANGE_LABELS)) {
    const n = counts[tbl]?.neu ?? 0
    if (n) parts.push(n === 1 ? `${article} ${one}` : `${n} ${many}`)
  }
  const changed = Object.values(counts).reduce((n, c) => n + (c.geaendert ?? 0), 0)
  const neu = parts.length ? `Neu: ${parts.join(', ')}` : ''
  const mod = changed ? `${changed} ${changed === 1 ? 'Änderung' : 'Änderungen'}` : ''
  return [neu, mod].filter(Boolean).join(' · ')
}

// ---------------------------------------------------------------- Dienst

/**
 * @param {ReturnType<import('./store.mjs').createStore>} store
 * @param {ReturnType<import('./members.mjs').createMembers>} members
 * @param {{ fetchImpl?: typeof fetch, subject?: string, hosts?: (RegExp|string)[], log?: (msg: string) => void }} [opts]
 */
export function createBenachrichtigungen(store, members, opts = {}) {
  const { db } = store
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch
  const subject = opts.subject || 'https://github.com/MrCatwiesel/KofferFertigRaus'
  const hosts = opts.hosts ?? PUSH_HOSTS
  const log = opts.log ?? ((m) => console.log(m))
  db.exec(`
    CREATE TABLE IF NOT EXISTS push_subs (
      device_id TEXT PRIMARY KEY, space TEXT NOT NULL, member TEXT, endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL, auth TEXT NOT NULL, prefs TEXT NOT NULL, created TEXT NOT NULL,
      last_ok TEXT, last_error TEXT
    );
    CREATE INDEX IF NOT EXISTS push_subs_space ON push_subs (space);
    CREATE TABLE IF NOT EXISTS push_schedule (
      owner TEXT NOT NULL, rid TEXT NOT NULL, at TEXT NOT NULL, title TEXT NOT NULL, body TEXT, url TEXT,
      sent TEXT,
      PRIMARY KEY (owner, rid, at)
    );
    CREATE INDEX IF NOT EXISTS push_schedule_due ON push_schedule (sent, at);
  `)

  // VAPID-Schlüssel einmal erzeugen und behalten (sonst müssten alle Geräte neu abonnieren)
  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run('vapid-jwk', JSON.stringify(newVapidJwk()))
  const vapid = vapidFromJwk(JSON.parse(db.prepare('SELECT value FROM settings WHERE key = ?').get('vapid-jwk').value))

  const q = {
    sub: db.prepare('SELECT * FROM push_subs WHERE device_id = ?'),
    upsert: db.prepare(`INSERT INTO push_subs (device_id, space, member, endpoint, p256dh, auth, prefs, created) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (device_id) DO UPDATE SET space = excluded.space, member = excluded.member, endpoint = excluded.endpoint,
        p256dh = excluded.p256dh, auth = excluded.auth, prefs = excluded.prefs, last_error = NULL`),
    setPrefs: db.prepare('UPDATE push_subs SET prefs = ? WHERE device_id = ?'),
    remove: db.prepare('DELETE FROM push_subs WHERE device_id = ?'),
    ok: db.prepare('UPDATE push_subs SET last_ok = ?, last_error = NULL WHERE device_id = ?'),
    error: db.prepare('UPDATE push_subs SET last_error = ? WHERE device_id = ?'),
    // nur Geräte, die noch angemeldet sind (abgemeldete Geräte bekommen nichts mehr)
    // Person aus dem Gerät (der Verwalter kann ein Gerät später einer Person zuordnen)
    active: db.prepare(`SELECT s.device_id, s.space, s.endpoint, s.p256dh, s.auth, s.prefs, d.member AS member
      FROM push_subs s JOIN devices d ON d.id = s.device_id WHERE d.revoked IS NULL AND s.space = ?`),
    removeSpace: db.prepare('DELETE FROM push_subs WHERE space = ?'),
    removeSpaceSchedule: db.prepare("DELETE FROM push_schedule WHERE owner = ? OR owner LIKE ? || ':%'"),
    clearOpen: db.prepare('DELETE FROM push_schedule WHERE owner = ? AND sent IS NULL'),
    addItem: db.prepare('INSERT OR IGNORE INTO push_schedule (owner, rid, at, title, body, url) VALUES (?, ?, ?, ?, ?, ?)'),
    countOpen: db.prepare('SELECT COUNT(*) AS n, MIN(at) AS next FROM push_schedule WHERE owner = ? AND sent IS NULL'),
    due: db.prepare('SELECT * FROM push_schedule WHERE sent IS NULL AND at <= ? ORDER BY at LIMIT 200'),
    markSent: db.prepare('UPDATE push_schedule SET sent = ? WHERE owner = ? AND rid = ? AND at = ?'),
    purge: db.prepare('DELETE FROM push_schedule WHERE (sent IS NOT NULL AND sent < ?) OR (sent IS NULL AND at < ?)')
  }

  const now = () => new Date().toISOString()
  const prefsOf = (row) => ({ ...DEFAULT_PREFS, ...JSON.parse(row.prefs || '{}') })
  const cleanPrefs = (p, base = DEFAULT_PREFS) => ({
    erinnerungen: typeof p?.erinnerungen === 'boolean' ? p.erinnerungen : base.erinnerungen,
    aenderungen: typeof p?.aenderungen === 'boolean' ? p.aenderungen : base.aenderungen,
    unwetter: typeof p?.unwetter === 'boolean' ? p.unwetter : base.unwetter,
    unwetterStufe: [2, 3, 4].includes(p?.unwetterStufe) ? p.unwetterStufe : base.unwetterStufe
  })
  /** Zeitplan gehört der Person – oder (Gerät ohne Person) der ganzen Gruppe */
  const ownerOf = (space, memberId) => (memberId ? `${space}:${memberId}` : space)

  /**
   * Eine Nachricht an ein Abo schicken.
   * @returns {Promise<{ ok: boolean, status: number, gone?: boolean }>}
   */
  async function deliver(sub, message, { ttl = 24 * 3600, urgency = 'normal' } = {}) {
    const body = encryptPayload(JSON.stringify(message), { p256dh: sub.p256dh, auth: sub.auth })
    const headers = {
      Authorization: vapidAuth(sub.endpoint, vapid, subject),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: urgency
    }
    let res
    try {
      res = await fetchImpl(sub.endpoint, { method: 'POST', headers, body, redirect: 'error', signal: AbortSignal.timeout(15_000) })
    } catch (e) {
      q.error.run(`Push-Dienst nicht erreichbar: ${e?.message ?? e}`.slice(0, 200), sub.device_id)
      return { ok: false, status: 0 }
    }
    if (res.ok) {
      q.ok.run(now(), sub.device_id)
      return { ok: true, status: res.status }
    }
    // 404/410: Abo gibt es beim Push-Dienst nicht mehr (Erlaubnis entzogen, App gelöscht) → vergessen
    if (res.status === 404 || res.status === 410) {
      q.remove.run(sub.device_id)
      return { ok: false, status: res.status, gone: true }
    }
    let detail = ''
    try {
      detail = (await res.text()).slice(0, 120)
    } catch {
      /* egal */
    }
    q.error.run(`Fehler ${res.status}${detail ? `: ${detail}` : ''}`, sub.device_id)
    return { ok: false, status: res.status }
  }

  /** Abos, die eine Nachricht der Art `pref` bekommen (Personen nur, solange sie aktiv sind) */
  function subsOf(space, pref) {
    return q.active.all(space).filter((s) => {
      if (!prefsOf(s)[pref]) return false
      if (!s.member) return true
      const m = members.get(space, s.member)
      return !!m && !m.disabled
    })
  }

  /** Abos einer Person (`space:member`) bzw. der Gruppe (`space`, Geräte ohne Person) – mit ihren Einstellungen */
  function subsOfOwner(owner, pref) {
    const [space, memberId] = owner.split(':')
    return subsOf(space, pref)
      .filter((s) => (memberId ? s.member === memberId : !s.member))
      .map((s) => ({ ...s, prefs: prefsOf(s) }))
  }

  // ---------------- Zeitplan

  async function sendDue(at = Date.now()) {
    const nowIso = new Date(at).toISOString()
    const tooLate = new Date(at - LATE_MS).toISOString()
    let sent = 0
    for (const item of q.due.all(nowIso)) {
      q.markSent.run(nowIso, item.owner, item.rid, item.at)
      if (item.at < tooLate) continue
      const [space, memberId] = item.owner.split(':')
      const targets = subsOf(space, 'erinnerungen').filter((s) => (memberId ? s.member === memberId : !s.member))
      for (const s of targets) {
        const r = await deliver(s, { title: item.title, body: item.body ?? '', url: item.url ?? '', tag: item.rid.slice(0, 100) }, { ttl: 6 * 3600, urgency: 'high' })
        if (r.ok) sent++
      }
    }
    q.purge.run(new Date(at - KEEP_SENT_MS).toISOString(), new Date(at - KEEP_SENT_MS).toISOString())
    return sent
  }

  function setSchedule(space, memberId, items) {
    if (!Array.isArray(items)) throw new HttpError(400, 'items fehlt')
    if (items.length > MAX_ITEMS) throw new HttpError(413, `Höchstens ${MAX_ITEMS} Erinnerungen.`)
    const owner = ownerOf(space, memberId)
    const clean = []
    for (const it of items) {
      const at = typeof it?.at === 'string' ? new Date(it.at) : null
      if (!at || Number.isNaN(at.getTime()) || typeof it.id !== 'string' || !it.id || typeof it.title !== 'string' || !it.title.trim()) throw new HttpError(400, 'Ungültige Erinnerung')
      const url = typeof it.url === 'string' && /^#\/[^\s]{0,300}$/.test(it.url) ? it.url : ''
      clean.push([it.id.slice(0, 200), at.toISOString(), it.title.trim().slice(0, 120), typeof it.body === 'string' ? it.body.slice(0, 300) : '', url])
    }
    db.exec('BEGIN')
    try {
      // Offene ersetzen, schon geschickte bleiben stehen → gleiche Erinnerung (id + Zeit) kommt nicht zweimal
      q.clearOpen.run(owner)
      for (const c of clean) q.addItem.run(owner, ...c)
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
    return q.countOpen.get(owner)
  }

  // ---------------- Änderungen anderer

  /** key `${device}|${trip}` → { space, trip, who: Set, counts: { tbl: { neu, geaendert } }, first } */
  const pending = new Map()
  /** key → Zeitpunkt der letzten Nachricht */
  const lastSent = new Map()

  /**
   * Nach dem Übernehmen von Änderungen (Abgleich): für Abos anderer Geräte vormerken.
   * @param {{ space: string, member: any, device: { id: string, name: string } | null, changes: { tbl: string, id: string, deleted?: boolean, data?: any, isNew: boolean }[] }} ev
   */
  function noteChanges({ space, member, device, changes }) {
    const relevant = changes.filter((c) => !c.deleted && CHANGE_LABELS[c.tbl])
    if (!relevant.length) return
    const subs = subsOf(space, 'aenderungen').filter((s) => (member ? s.member !== member.id : s.device_id !== device?.id))
    if (!subs.length) return
    const who = member?.name ?? device?.name ?? 'Jemand'
    const t = Date.now()
    for (const s of subs) {
      const access = members.accessFor(space, s.member ? members.get(space, s.member) : null)
      for (const c of relevant) {
        const trip = tripOf(c.tbl, c.id, c.data)
        if (!trip || !access.canSee(c.tbl, c.id, c.data)) continue
        const key = `${s.device_id}|${trip}`
        let p = pending.get(key)
        if (!p) pending.set(key, (p = { space, trip, device: s.device_id, who: new Set(), counts: {}, first: t }))
        p.who.add(who)
        const cnt = (p.counts[c.tbl] ??= { neu: 0, geaendert: 0 })
        if (c.isNew) cnt.neu++
        else cnt.geaendert++
      }
    }
  }

  async function sendChanges(at = Date.now()) {
    let sent = 0
    for (const [key, p] of pending) {
      if (at - p.first < COLLECT_MS || at - (lastSent.get(key) ?? 0) < COOLDOWN_MS) continue
      pending.delete(key)
      const sub = q.sub.get(p.device)
      if (!sub || !prefsOf(sub).aenderungen) continue
      const trip = store.record(p.space, 'trips', p.trip)
      if (!trip) continue
      lastSent.set(key, at)
      const who = [...p.who].slice(0, 3).join(', ')
      const r = await deliver(sub, {
        title: `${trip.title || 'Reise'}: ${who}`,
        body: changeSummary(p.counts),
        url: `#/trip/${p.trip}`,
        tag: `trip:${p.trip}`
      }, { ttl: 24 * 3600 })
      if (r.ok) sent++
    }
    for (const [key, t] of lastSent) if (at - t > COOLDOWN_MS * 4) lastSent.delete(key)
    return sent
  }

  // ---------------- Takt

  let running = false
  async function tick(at = Date.now()) {
    if (running) return { erinnerungen: 0, aenderungen: 0 }
    running = true
    try {
      return { erinnerungen: await sendDue(at), aenderungen: await sendChanges(at) }
    } catch (e) {
      log(`Benachrichtigungen: ${e?.message ?? e}`)
      return { erinnerungen: 0, aenderungen: 0 }
    } finally {
      running = false
    }
  }
  let timer = null

  return {
    publicKey: vapid.publicKey,
    tick,
    noteChanges,
    setSchedule,
    deliver,
    subsOfOwner,

    start() {
      if (!timer) timer = setInterval(() => void tick(), TICK_MS)
      timer.unref?.()
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },

    removeSpace(space) {
      q.removeSpace.run(space)
      q.removeSpaceSchedule.run(space, space)
      for (const [key, p] of pending) if (p.space === space) pending.delete(key)
    },

    /** Abo eines Geräts entfernen (abgemeldet) */
    removeDevice(deviceId) {
      q.remove.run(deviceId)
    },

    async handle(req, res, path, auth) {
      const { group, device, member } = auth
      const space = group.space
      const sub = path.slice('/api/benachrichtigungen'.length)
      const owner = ownerOf(space, member?.id ?? null)
      if (sub === '' && req.method === 'GET') {
        const row = device ? q.sub.get(device.id) : null
        const open = q.countOpen.get(owner)
        return send(res, 200, {
          publicKey: vapid.publicKey,
          abo: row ? { endpointHost: new URL(row.endpoint).hostname, prefs: prefsOf(row), created: row.created, lastOk: row.last_ok, lastError: row.last_error } : null,
          geplant: open.n,
          naechste: open.next ?? null,
          // Geräte dieser Person mit Erinnerungen – dann hält jedes ihrer Geräte den Zeitplan aktuell
          geraete: subsOf(space, 'erinnerungen').filter((s) => (member ? s.member === member.id : !s.member)).length
        })
      }
      if (!device) throw new HttpError(400, 'Benachrichtigungen brauchen eine Geräte-Anmeldung (Geräte-Abgleich → Verbindung).')

      if (sub === '/abo' && req.method === 'PUT') {
        const body = await readJson(req)
        if (!validEndpoint(body.endpoint, hosts)) throw new HttpError(400, 'Unbekannter Push-Dienst.')
        const keys = body.keys ?? {}
        if (!B64URL_RE.test(keys.p256dh ?? '') || !B64URL_RE.test(keys.auth ?? '')) throw new HttpError(400, 'Schlüssel des Abos fehlen.')
        // Schlüssel gleich prüfen (Länge, Kurvenpunkt) – sonst scheitert erst das Senden
        encryptPayload('x', keys)
        const old = q.sub.get(device.id)
        const prefs = cleanPrefs(body.prefs, old ? prefsOf(old) : DEFAULT_PREFS)
        q.upsert.run(device.id, space, member?.id ?? null, body.endpoint, keys.p256dh, keys.auth, JSON.stringify(prefs), old?.created ?? now())
        return send(res, 200, { ok: true, prefs })
      }
      if (sub === '/abo' && req.method === 'PATCH') {
        const row = q.sub.get(device.id)
        if (!row) throw new HttpError(404, 'Auf diesem Gerät sind Benachrichtigungen nicht eingeschaltet.')
        const prefs = cleanPrefs((await readJson(req)).prefs, prefsOf(row))
        q.setPrefs.run(JSON.stringify(prefs), device.id)
        return send(res, 200, { ok: true, prefs })
      }
      if (sub === '/abo' && req.method === 'DELETE') {
        q.remove.run(device.id)
        return send(res, 200, { ok: true })
      }
      if (sub === '/test' && req.method === 'POST') {
        const row = q.sub.get(device.id)
        if (!row) throw new HttpError(404, 'Auf diesem Gerät sind Benachrichtigungen nicht eingeschaltet.')
        const r = await deliver(row, { title: 'KofferFertigRaus', body: 'Benachrichtigungen funktionieren 👍', url: '#/', tag: 'test' }, { ttl: 600, urgency: 'high' })
        if (r.gone) throw new HttpError(410, 'Der Push-Dienst kennt dieses Gerät nicht mehr – bitte Benachrichtigungen neu einschalten.')
        if (!r.ok) throw new HttpError(502, q.sub.get(device.id)?.last_error ?? 'Senden ging nicht.')
        return send(res, 200, { ok: true })
      }
      if (sub === '/zeitplan' && req.method === 'PUT') {
        const body = await readJson(req, 512 * 1024)
        const open = setSchedule(space, member?.id ?? null, body.items)
        return send(res, 200, { ok: true, geplant: open.n, naechste: open.next ?? null })
      }
      throw new HttpError(404, 'Unbekannte Adresse')
    }
  }
}
