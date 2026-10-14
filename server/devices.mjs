/**
 * Geräte-Anmeldung („Sessions“):
 *  - Jedes Gerät bekommt beim Verbinden einen eigenen, zufälligen Zugang (`nwd_…`). Gespeichert wird nur
 *    seine Prüfsumme. Einzelne Geräte lassen sich abmelden, ohne die anderen zu stören.
 *  - Anmelden mit dem Schlüssel der Reisegruppe oder mit einer Einladung (Code, einmal gültig, 24 Stunden).
 *  - Geräte, die lange nicht da waren, werden automatisch abgemeldet (NWW_DEVICE_IDLE_DAYS, Standard 180).
 *  - Viele Fehlversuche von derselben Adresse → kurze Sperre (gegen Ausprobieren von Schlüsseln).
 *  - Der Gruppenschlüssel funktioniert weiterhin direkt (ältere App-Versionen, Verwaltung).
 *  - Personen (members.mjs): Geräte gehören einer Person; Einladung für eine Person legt ihr Passwort fest,
 *    danach Anmeldung mit Name + Passwort. Geräte ohne Person haben – wie bisher – vollen Zugriff.
 */
import { randomBytes, randomInt } from 'node:crypto'
import { HttpError, readJson, send } from './http.mjs'
import { sha256 } from './store.mjs'
import { checkPassword, validPassword } from './members.mjs'

const TOKEN_PREFIX = 'nwd_'
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // ohne 0/O, 1/I – gut abzutippen
const CODE_LEN = 12
const INVITE_MS = 24 * 3600_000
const MAX_OPEN_INVITES = 10
const SEEN_EVERY_MS = 5 * 60_000
const KEEP_REVOKED_MS = 60 * 86400_000

const FAIL_WINDOW_MS = 10 * 60_000
const FAIL_LIMIT = 20
const LOCK_MS = 15 * 60_000

/** Einladungscode lesbar: ABCD-EFGH-JKLM */
export const formatCode = (c) => c.match(/.{1,4}/g).join('-')
/** Eingabe vereinheitlichen: Großbuchstaben, ohne Leer- und Bindestriche, verwechselbare Zeichen ersetzt. */
export const normalizeCode = (s) =>
  String(s ?? '')
    .toUpperCase()
    .replace(/[\s-]/g, '')
export const isCode = (s) => new RegExp(`^[${CODE_ALPHABET}]{${CODE_LEN}}$`).test(normalizeCode(s))

const PRIVATE_IP = /^(::ffff:)?(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|^::1$|^f[cd]/i

/**
 * Adresse des Aufrufers. Steht der Server hinter einem Reverse-Proxy im Heimnetz (Nginx Proxy Manager),
 * kommt die echte Adresse aus X-Forwarded-For – aber nur, wenn die Verbindung selbst aus dem eigenen Netz kommt.
 */
export function clientIp(req) {
  const direct = req.socket?.remoteAddress ?? ''
  if (!PRIVATE_IP.test(direct)) return direct
  // Von rechts lesen: eigene Proxys (private Adressen) überspringen, die erste öffentliche Adresse ist der Absender.
  // Die vorderen Einträge kann der Absender frei erfinden – sie zählen nur, wenn alles im eigenen Netz liegt.
  const chain = String(req.headers['x-forwarded-for'] ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  if (!chain.length) return direct
  for (let i = chain.length - 1; i >= 0; i--) if (!PRIVATE_IP.test(chain[i])) return chain[i]
  return chain[0]
}

/** Kurzer Gerätetyp aus der Browser-Kennung (nur zur Anzeige). */
export function agentLabel(ua) {
  const s = String(ua ?? '')
  const os = /iPad/.test(s) ? 'iPad' : /iPhone/.test(s) ? 'iPhone' : /Android/.test(s) ? 'Android' : /Mac OS X/.test(s) ? 'Mac' : /Windows/.test(s) ? 'Windows' : /Linux/.test(s) ? 'Linux' : ''
  const br = /Edg\//.test(s) ? 'Edge' : /Firefox\//.test(s) ? 'Firefox' : /Chrome\//.test(s) ? 'Chrome' : /Safari\//.test(s) ? 'Safari' : ''
  return [os, br].filter(Boolean).join(' · ').slice(0, 60)
}

export function createDevices(store, groups, members, opts = {}) {
  const { db } = store
  const idleDays = Number(opts.idleDays ?? 180)
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY, space TEXT NOT NULL, name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE,
      created TEXT NOT NULL, last_seen TEXT, agent TEXT, revoked TEXT, reason TEXT
    );
    CREATE INDEX IF NOT EXISTS devices_space ON devices (space);
    CREATE TABLE IF NOT EXISTS invites (
      code_hash TEXT PRIMARY KEY, space TEXT NOT NULL, created TEXT NOT NULL, expires TEXT NOT NULL,
      used TEXT, created_by TEXT
    );
  `)
  // Neuere Spalten in bestehenden Datenbanken ergänzen: Abgleich-Stand je Gerät
  const cols = new Set(db.prepare('PRAGMA table_info(devices)').all().map((c) => c.name))
  if (!cols.has('pull_seq')) db.exec('ALTER TABLE devices ADD COLUMN pull_seq INTEGER')
  if (!cols.has('pending')) db.exec('ALTER TABLE devices ADD COLUMN pending INTEGER')
  if (!cols.has('synced')) db.exec('ALTER TABLE devices ADD COLUMN synced TEXT')
  if (!cols.has('member')) db.exec('ALTER TABLE devices ADD COLUMN member TEXT')
  // Wechselt die Person eines Geräts, gleicht es einmal vollständig neu ab (Kennung in /api/info)
  if (!cols.has('epoch')) db.exec('ALTER TABLE devices ADD COLUMN epoch TEXT')
  const icols = new Set(db.prepare('PRAGMA table_info(invites)').all().map((c) => c.name))
  if (!icols.has('member')) db.exec('ALTER TABLE invites ADD COLUMN member TEXT')
  if (!icols.has('reset')) db.exec('ALTER TABLE invites ADD COLUMN reset INTEGER')

  const q = {
    syncState: db.prepare('UPDATE devices SET pull_seq = COALESCE(?, pull_seq), pending = COALESCE(?, pending), synced = ? WHERE id = ?'),
    byToken: db.prepare('SELECT * FROM devices WHERE token_hash = ?'),
    byId: db.prepare('SELECT * FROM devices WHERE id = ? AND space = ?'),
    list: db.prepare('SELECT * FROM devices WHERE space = ? AND revoked IS NULL ORDER BY created'),
    insert: db.prepare('INSERT INTO devices (id, space, name, token_hash, created, last_seen, agent, member) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
    setMember: db.prepare('UPDATE devices SET member = ?, epoch = ? WHERE id = ? AND space = ?'),
    revokeMember: db.prepare('UPDATE devices SET revoked = ?, reason = ? WHERE space = ? AND member = ? AND revoked IS NULL'),
    seen: db.prepare('UPDATE devices SET last_seen = ?, agent = ? WHERE id = ?'),
    rename: db.prepare('UPDATE devices SET name = ? WHERE id = ? AND space = ?'),
    revoke: db.prepare('UPDATE devices SET revoked = ?, reason = ? WHERE id = ? AND space = ? AND revoked IS NULL'),
    revokeOthers: db.prepare('UPDATE devices SET revoked = ?, reason = ? WHERE space = ? AND id != ? AND revoked IS NULL'),
    revokeIdle: db.prepare("UPDATE devices SET revoked = ?, reason = 'lange nicht benutzt' WHERE revoked IS NULL AND COALESCE(last_seen, created) < ?"),
    purgeRevoked: db.prepare('DELETE FROM devices WHERE revoked IS NOT NULL AND revoked < ?'),
    invite: db.prepare('INSERT INTO invites (code_hash, space, created, expires, created_by, member, reset) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    inviteByHash: db.prepare('SELECT * FROM invites WHERE code_hash = ?'),
    useInvite: db.prepare('UPDATE invites SET used = ? WHERE code_hash = ? AND used IS NULL'),
    openInvites: db.prepare('SELECT COUNT(*) AS n FROM invites WHERE space = ? AND used IS NULL AND expires > ?'),
    purgeInvites: db.prepare('DELETE FROM invites WHERE expires < ?'),
    removeSpaceDevices: db.prepare('DELETE FROM devices WHERE space = ?'),
    removeSpaceInvites: db.prepare('DELETE FROM invites WHERE space = ?'),
    keyUse: db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value"),
    keyUseGet: db.prepare('SELECT value FROM settings WHERE key = ?')
  }
  const keyUseAt = new Map()

  const now = () => new Date().toISOString()
  const lastSeen = new Map()
  const fails = new Map()

  function cleanup() {
    const t = Date.now()
    if (idleDays > 0) q.revokeIdle.run(now(), new Date(t - idleDays * 86400_000).toISOString())
    q.purgeRevoked.run(new Date(t - KEEP_REVOKED_MS).toISOString())
    q.purgeInvites.run(new Date(t - 7 * 86400_000).toISOString())
  }
  cleanup()
  const timer = setInterval(cleanup, 6 * 3600_000)
  timer.unref?.()

  // ---------- Fehlversuche bremsen ----------
  function checkLock(req) {
    const f = fails.get(clientIp(req))
    if (f?.until && f.until > Date.now()) throw new HttpError(429, 'Zu viele Fehlversuche – bitte 15 Minuten warten.')
  }
  /**
   * Fehlversuch zählen. Die Sperre greift nur bei falschen Zugangsdaten – wer einen gültigen Zugang hat,
   * kommt immer durch (sonst könnte ein Fremder durch Falscheingaben andere aussperren).
   */
  function fail(req) {
    checkLock(req)
    const ip = clientIp(req)
    const t = Date.now()
    const f = fails.get(ip)
    const entry = f && t - f.first < FAIL_WINDOW_MS ? f : { first: t, count: 0, until: 0 }
    entry.count++
    if (entry.count >= FAIL_LIMIT) entry.until = t + LOCK_MS
    fails.set(ip, entry)
    if (fails.size > 5000) for (const [k, v] of fails) if (t - v.first > FAIL_WINDOW_MS && v.until < t) fails.delete(k)
  }

  const toDevice = (row, currentId, headSeq = null) => ({
    id: row.id,
    name: row.name,
    created: row.created,
    lastSeen: row.last_seen,
    agent: row.agent ?? '',
    current: row.id === currentId,
    member: row.member ?? null,
    // Abgleich-Stand: wie viele Änderungen dem Gerät noch fehlen, wie viele es noch nicht hochgeladen hat
    synced: row.synced ?? null,
    behind: headSeq !== null && row.pull_seq !== null && row.pull_seq !== undefined ? Math.max(0, headSeq - row.pull_seq) : null,
    pending: row.pending ?? null
  })

  function newDevice(space, name, req, member = null) {
    const token = TOKEN_PREFIX + randomBytes(24).toString('base64url')
    const id = randomBytes(8).toString('hex')
    const clean = String(name ?? '').trim().slice(0, 60) || agentLabel(req.headers['user-agent']) || 'Gerät'
    q.insert.run(id, space, clean, sha256(token), now(), now(), agentLabel(req.headers['user-agent']), member)
    const m = member ? members.get(space, member) : null
    return { token, device: toDevice(q.byId.get(id, space), id), member: m ? members.toMember(m) : null }
  }

  /** Einladung: für ein weiteres Gerät (ohne Person) oder für eine Person (`reset`: Passwort neu festlegen). */
  function newInvite(space, createdBy, member = null, reset = false) {
    if (q.openInvites.get(space, now()).n >= MAX_OPEN_INVITES) throw new HttpError(400, 'Zu viele offene Einladungen – bitte später erneut.')
    let code = ''
    for (let i = 0; i < CODE_LEN; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]
    const expires = new Date(Date.now() + INVITE_MS).toISOString()
    q.invite.run(sha256(code), space, now(), expires, createdBy, member, reset ? 1 : 0)
    return { code: formatCode(code), expires, member }
  }

  /** Gültige, unbenutzte Einladung – sonst Fehlversuch und Fehler. */
  function openInvite(req, raw) {
    const code = normalizeCode(raw)
    const inv = isCode(code) ? q.inviteByHash.get(sha256(code)) : null
    if (!inv || inv.used || inv.expires < now()) {
      fail(req)
      throw new HttpError(400, inv?.used ? 'Diese Einladung wurde schon benutzt.' : 'Einladung ungültig oder abgelaufen.')
    }
    const group = groups.get(inv.space)
    if (!group || group.disabled) throw new HttpError(400, 'Diese Reisegruppe ist gesperrt.')
    const member = inv.member ? members.get(inv.space, inv.member) : null
    if (inv.member && (!member || member.disabled)) throw new HttpError(400, 'Diese Person gibt es nicht mehr oder sie ist gesperrt.')
    return { code, inv, group, member, needsPassword: !!member && (!member.pw_hash || !!inv.reset) }
  }

  /**
   * Wer fragt? → { group, device } oder Fehler.
   * Gerätezugang (nwd_…) oder – wie bisher – Schlüssel der Reisegruppe.
   */
  function authenticate(req) {
      const m = (req.headers.authorization ?? '').match(/^Bearer\s+(.+)$/i)
      const token = m?.[1].trim() ?? ''
      if (token.startsWith(TOKEN_PREFIX)) {
        const row = q.byToken.get(sha256(token))
        if (!row) {
          fail(req)
          throw new HttpError(401, 'Zugang unbekannt.')
        }
        // Abgemeldete Geräte zählen nicht als Fehlversuch – sie bekommen einen klaren Hinweis
        if (row.revoked) throw new HttpError(401, 'Dieses Gerät wurde abgemeldet.', { code: 'abgemeldet', reason: row.reason ?? '' })
        const group = groups.get(row.space)
        if (!group || group.disabled) throw new HttpError(401, 'Diese Reisegruppe ist gesperrt.', { code: 'gesperrt' })
        const t = Date.now()
        if ((lastSeen.get(row.id) ?? 0) + SEEN_EVERY_MS < t) {
          lastSeen.set(row.id, t)
          q.seen.run(new Date(t).toISOString(), agentLabel(req.headers['user-agent']) || row.agent, row.id)
        }
        let member = null
        if (row.member) {
          member = members.get(row.space, row.member)
          if (!member) throw new HttpError(401, 'Diese Person gibt es nicht mehr.', { code: 'abgemeldet', reason: 'Person entfernt' })
          if (member.disabled) throw new HttpError(401, 'Dein Zugang ist gesperrt.', { code: 'gesperrt' })
        }
        return { group, device: { id: row.id, name: row.name, epoch: row.epoch ?? '' }, member }
      }
      const group = token ? groups.authenticate(req) : null
      if (!group) {
        if (token) fail(req)
        throw new HttpError(401, 'Schlüssel fehlt oder ist falsch.')
      }
      return { group, device: null, member: null }
  }

  return {
    authenticate,

    /**
     * POST /api/anmelden – ohne Gerätezugang:
     *  { invite, name, password? }  Einladungscode (für eine Person: Passwort festlegen, wenn nötig)
     *  { login, password, name }    Name + Passwort einer Person
     *  Bearer-Gruppenschlüssel       Gerät ohne Person (voller Zugriff)
     */
    async login(req, res) {
      if (req.method !== 'POST') throw new HttpError(405, 'Nicht erlaubt')
      checkLock(req)
      const body = await readJson(req)
      if (body.invite !== undefined) {
        const { code, inv, group, member, needsPassword } = openInvite(req, body.invite)
        if (body.check === true) return send(res, 200, { group: group.name, person: member?.name ?? null, needsPassword })
        if (needsPassword) validPassword(body.password)
        if (q.useInvite.run(now(), sha256(code)).changes !== 1) throw new HttpError(400, 'Diese Einladung wurde schon benutzt.')
        if (needsPassword) members.setPassword(member.id, body.password)
        return send(res, 201, { ...newDevice(inv.space, body.name, req, member?.id ?? null), group: group.name })
      }
      if (body.login !== undefined) {
        const member = members.byLogin(body.login)
        const ok = !!member && checkPassword(String(body.password ?? ''), member.pw_hash)
        if (!ok) {
          fail(req)
          throw new HttpError(401, 'Name oder Passwort stimmt nicht.')
        }
        if (member.disabled) throw new HttpError(401, 'Dein Zugang ist gesperrt.', { code: 'gesperrt' })
        const group = groups.get(member.space)
        if (!group || group.disabled) throw new HttpError(401, 'Diese Reisegruppe ist gesperrt.', { code: 'gesperrt' })
        return send(res, 201, { ...newDevice(member.space, body.name, req, member.id), group: group.name })
      }
      const { group, device } = authenticate(req)
      if (device) throw new HttpError(400, 'Dieses Gerät ist schon angemeldet.')
      return send(res, 201, { ...newDevice(group.space, body.name, req), group: group.name })
    },

    /** Verwaltung: /api/geraete…, /api/einladungen (angemeldet). */
    async handle(req, res, path, auth) {
      const { group, device, member } = auth
      const space = group.space
      const admin = !member || member.role === 'verwalter'
      if (path === '/api/einladungen' && req.method === 'POST') {
        // Eine Person lädt nur eigene Geräte ein; Verwalter auch für andere Personen
        const body = await readJson(req).catch(() => ({}))
        let target = member?.id ?? null
        if (admin && typeof body.member === 'string' && body.member) {
          if (!members.get(space, body.member)) throw new HttpError(404, 'Person nicht gefunden.')
          target = body.member
        }
        return send(res, 201, newInvite(space, device?.id ?? null, target, admin && body.reset === true))
      }

      const sub = path.slice('/api/geraete'.length)
      if (sub === '' && req.method === 'GET') {
        const headSeq = store.info(space).seq
        return send(res, 200, {
          headSeq,
          devices: q.list.all(space).filter((r) => admin || r.member === member.id).map((r) => toDevice(r, device?.id, headSeq)),
          // Abgleich direkt mit dem Gruppenschlüssel (ältere App-Versionen)
          keyLastSeen: q.keyUseGet.get(`keyuse:${space}`)?.value ?? null,
          current: device?.id ?? null,
          idleDays
        })
      }
      if (sub === '/andere-abmelden' && req.method === 'POST') {
        if (!device) throw new HttpError(400, 'Nur von einem angemeldeten Gerät aus möglich.')
        const n = admin
          ? q.revokeOthers.run(now(), 'von einem anderen Gerät abgemeldet', space, device.id).changes
          : db.prepare('UPDATE devices SET revoked = ?, reason = ? WHERE space = ? AND member = ? AND id != ? AND revoked IS NULL').run(now(), 'von einem anderen Gerät abgemeldet', space, member.id, device.id).changes
        return send(res, 200, { ok: true, revoked: n })
      }
      const m = sub.match(/^\/([a-f0-9]{16}|ich)$/)
      if (!m) throw new HttpError(404, 'Unbekannte Adresse')
      const id = m[1] === 'ich' ? device?.id : m[1]
      const row = id ? q.byId.get(id, space) : null
      if (!row || (!admin && row.member !== member.id)) throw new HttpError(404, 'Gerät nicht gefunden.')
      if (req.method === 'PATCH') {
        const body = await readJson(req)
        // Gerät einer Person zuordnen (Verwalter; ein Gerät ohne Person auch sich selbst)
        if ('member' in body) {
          const canAssign = admin || (!row.member && id === device?.id)
          if (!canAssign) throw new HttpError(403, 'Nur Verwalter ordnen Geräte zu.')
          const target = body.member ? members.get(space, body.member) : null
          if (body.member && !target) throw new HttpError(404, 'Person nicht gefunden.')
          q.setMember.run(target?.id ?? null, randomBytes(6).toString('hex'), id, space)
        }
        if (body.name !== undefined) {
          const name = String(body.name ?? '').trim().slice(0, 60)
          if (!name) throw new HttpError(400, 'Name fehlt.')
          q.rename.run(name, id, space)
        }
        return send(res, 200, toDevice(q.byId.get(id, space), device?.id))
      }
      if (req.method === 'DELETE') {
        q.revoke.run(now(), id === device?.id ? 'selbst abgemeldet' : 'von einem anderen Gerät abgemeldet', id, space)
        return send(res, 200, { ok: true })
      }
      throw new HttpError(405, 'Nicht erlaubt')
    },

    /**
     * Abgleich-Stand eines Geräts merken: nach dem Abholen (bis Stand `seq`, alles geholt) und mit der Zahl
     * seiner noch nicht hochgeladenen Änderungen (Kopfzeile X-NWW-Pending).
     */
    noteSync(deviceId, req, seq = null) {
      const p = Number.parseInt(String(req.headers['x-nww-pending'] ?? ''), 10)
      q.syncState.run(seq, Number.isFinite(p) && p >= 0 ? p : null, now(), deviceId)
    },

    /** Abgleich mit dem Gruppenschlüssel statt Gerätezugang merken (für den Hinweis in der Geräteliste). */
    noteKeyUse(space) {
      const t = Date.now()
      if ((keyUseAt.get(space) ?? 0) + SEEN_EVERY_MS > t) return
      keyUseAt.set(space, t)
      q.keyUse.run(`keyuse:${space}`, new Date(t).toISOString())
    },

    /** Einladung anlegen (Personen-Verwaltung). */
    invite(space, createdBy, memberId, reset = false) {
      return newInvite(space, createdBy, memberId, reset)
    },

    /** Gerät einer Person zuordnen – es gleicht danach einmal vollständig neu ab. */
    assign(space, deviceId, memberId) {
      q.setMember.run(memberId, randomBytes(6).toString('hex'), deviceId, space)
    },

    /** Alle Geräte einer Person abmelden (Person entfernt). */
    revokeMember(space, memberId, reason) {
      q.revokeMember.run(now(), reason, space, memberId)
    },

    removeSpace(space) {
      q.removeSpaceDevices.run(space)
      q.removeSpaceInvites.run(space)
    },

    /** Gerätezugänge einer Gruppe beenden (z. B. nach Sperren durch den Besitzer – optional) */
    revokeAll(space, reason) {
      db.prepare('UPDATE devices SET revoked = ?, reason = ? WHERE space = ? AND revoked IS NULL').run(now(), reason, space)
    }
  }
}
