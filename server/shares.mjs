/**
 * Lese-Links: eine Reise für Freunde zum Ansehen freigeben – ohne Schlüssel, ohne Änderungsrecht.
 *
 * Herausgegeben wird nur, was ausdrücklich dazugehört: Reise-Eckdaten (Titel, Ziel, Zeitraum),
 * Tagebucheinträge (alle oder nur Highlights) und deren Fotos. Planung, Budget, Ausgaben, Apotheke,
 * Dokumente, Notfallnummern und Mitreisende bleiben immer privat.
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { HttpError, readJson, send } from './http.mjs'

const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/
const MODES = new Set(['highlights', 'journal'])
const TEMPLATES = new Set(['klassisch', 'magazin', 'galerie'])
const TICKET_MS = 12 * 3600_000

const newToken = () => randomBytes(16).toString('base64url')

function hashPassword(pw) {
  const salt = randomBytes(16)
  return `scrypt$${salt.toString('hex')}$${scryptSync(pw, salt, 32).toString('hex')}`
}

function checkPassword(pw, stored) {
  const [, salt, hash] = String(stored).split('$')
  if (!salt || !hash) return false
  const got = scryptSync(String(pw ?? ''), Buffer.from(salt, 'hex'), 32)
  return timingSafeEqual(got, Buffer.from(hash, 'hex'))
}

/** Nur bekannte, harmlose Gestaltungswerte übernehmen. */
function cleanLook(look) {
  if (!look || typeof look !== 'object') return null
  return {
    template: TEMPLATES.has(look.template) ? look.template : 'klassisch',
    accent: /^#[0-9a-f]{6}$/i.test(look.accent ?? '') ? look.accent : '#0d6efd',
    font: /^[a-z0-9-]{1,30}$/.test(look.font ?? '') ? look.font : 'modern',
    dark: !!look.dark,
    showMood: look.showMood !== false,
    showLocation: look.showLocation !== false
  }
}

function cleanOptions(body, old = {}) {
  const mode = body.mode ?? old.mode ?? 'highlights'
  if (!MODES.has(mode)) throw new HttpError(400, 'Unbekannte Auswahl (highlights oder journal).')
  return {
    mode,
    photos: typeof body.photos === 'boolean' ? body.photos : old.photos ?? true,
    title: typeof body.title === 'string' ? body.title.trim().slice(0, 120) : old.title ?? '',
    note: typeof body.note === 'string' ? body.note.trim().slice(0, 80) : old.note ?? '',
    look: body.look === null ? null : cleanLook(body.look) ?? old.look ?? null
  }
}

function expiryFrom(days) {
  if (days === null || days === undefined || days === 0) return null
  const n = Number(days)
  if (!Number.isFinite(n) || n < 0 || n > 3650) throw new HttpError(400, 'Ungültige Laufzeit.')
  return new Date(Date.now() + n * 86400_000).toISOString()
}

export function createShares(store) {
  const { db } = store
  const secret = store.secret('share-secret')
  const fails = new Map()

  const q = {
    get: db.prepare('SELECT * FROM shares WHERE token = ?'),
    list: db.prepare('SELECT * FROM shares WHERE space = ? AND (? IS NULL OR trip_id = ?) ORDER BY created DESC'),
    insert: db.prepare('INSERT INTO shares (token, space, trip_id, options, pw_hash, expires, created) VALUES (?, ?, ?, ?, ?, ?, ?)'),
    update: db.prepare('UPDATE shares SET options = ?, pw_hash = ?, expires = ?, revoked = ? WHERE token = ? AND space = ?'),
    remove: db.prepare('DELETE FROM shares WHERE token = ? AND space = ?'),
    access: db.prepare('UPDATE shares SET last_access = ?, access_count = access_count + 1 WHERE token = ?')
  }

  const toShare = (r) => ({
    token: r.token,
    tripId: r.trip_id,
    ...JSON.parse(r.options),
    password: !!r.pw_hash,
    expires: r.expires,
    revoked: !!r.revoked,
    created: r.created,
    lastAccess: r.last_access,
    accessCount: r.access_count
  })

  const ticketFor = (token, exp) => `${exp}.${createHmac('sha256', secret).update(`${token}.${exp}`).digest('base64url')}`
  function ticketValid(token, ticket) {
    const [exp, sig] = String(ticket ?? '').split('.')
    if (!exp || !sig || Number(exp) < Date.now()) return false
    const want = Buffer.from(ticketFor(token, exp).split('.')[1])
    const got = Buffer.from(sig)
    return want.length === got.length && timingSafeEqual(want, got)
  }

  /** Link prüfen: gibt es ihn, ist er gültig, stimmt das Passwort? */
  function open(token, req, url, { allowTicket = false } = {}) {
    if (!TOKEN_RE.test(token)) throw new HttpError(404, 'Link nicht gefunden.')
    const row = q.get.get(token)
    if (!row) throw new HttpError(404, 'Link nicht gefunden.')
    if (row.revoked) throw new HttpError(410, 'Dieser Link wurde zurückgezogen.')
    if (row.expires && row.expires < new Date().toISOString()) throw new HttpError(410, 'Dieser Link ist abgelaufen.')
    if (row.pw_hash) {
      if (allowTicket && ticketValid(token, url.searchParams.get('t'))) return row
      const f = fails.get(token)
      if (f && f.until > Date.now()) throw new HttpError(429, 'Zu viele Versuche – bitte kurz warten.')
      const pw = req.headers['x-share-password']
      if (!pw) throw new HttpError(401, 'Passwort nötig.', { needPassword: true })
      if (!checkPassword(pw, row.pw_hash)) {
        const n = (f?.n ?? 0) + 1
        fails.set(token, { n, until: n >= 5 ? Date.now() + 60_000 * (n - 4) : 0 })
        throw new HttpError(401, 'Passwort falsch.', { needPassword: true })
      }
      fails.delete(token)
    }
    return row
  }

  /** Was der Link zeigt – streng gefiltert. */
  function content(row) {
    const opts = JSON.parse(row.options)
    const trip = store.record(row.space, 'trips', row.trip_id)
    if (!trip) throw new HttpError(404, 'Diese Reise gibt es nicht mehr.')
    const site = store.record(row.space, 'websites', row.trip_id)
    const photos = new Map(opts.photos ? store.byTrip(row.space, 'photos', row.trip_id).map((p) => [p.id, p]) : [])
    const entries = store
      .byTrip(row.space, 'journalEntries', row.trip_id)
      .filter((e) => opts.mode === 'journal' || e.highlight)
      .map((e) => ({
        date: String(e.date ?? ''),
        title: String(e.title ?? ''),
        text: String(e.text ?? ''),
        mood: Number(e.mood) || 0,
        location: String(e.location ?? ''),
        highlight: !!e.highlight,
        createdAt: String(e.createdAt ?? ''),
        photos: (e.photoIds ?? [])
          .map((id) => photos.get(id))
          .filter(Boolean)
          .map((p) => ({ id: p.id, width: Number(p.width) || 0, height: Number(p.height) || 0, caption: String(p.caption ?? '') }))
      }))
    const look = opts.look ?? cleanLook(site) ?? cleanLook({})
    return {
      title: opts.title || site?.title || trip.title || 'Reise',
      subtitle: site?.subtitle || trip.destination || '',
      intro: site?.intro || '',
      author: site?.author || '',
      trip: { destination: String(trip.destination ?? ''), startDate: String(trip.startDate ?? ''), endDate: String(trip.endDate ?? '') },
      mode: opts.mode,
      look,
      entries
    }
  }

  /** Fotos dieses Links: nur aus den freigegebenen Einträgen. */
  function allowedPhotoIds(row) {
    return new Set(content(row).entries.flatMap((e) => e.photos.map((p) => p.id)))
  }

  return {
    /** Verwaltung durch die Reisegruppe (mit Schlüssel). */
    async handleOwner(req, res, url, path, group) {
      const sub = path.slice('/api/shares'.length)
      if (sub === '' && req.method === 'GET') {
        const tripId = url.searchParams.get('tripId')
        return send(res, 200, { shares: q.list.all(group.space, tripId, tripId).map(toShare) })
      }
      if (sub === '' && req.method === 'POST') {
        const body = await readJson(req)
        if (typeof body.tripId !== 'string' || !body.tripId) throw new HttpError(400, 'tripId fehlt.')
        if (!store.record(group.space, 'trips', body.tripId)) throw new HttpError(400, 'Reise ist noch nicht auf dem Server – erst abgleichen.')
        const token = newToken()
        const pw = typeof body.password === 'string' && body.password ? hashPassword(body.password.slice(0, 200)) : null
        q.insert.run(token, group.space, body.tripId, JSON.stringify(cleanOptions(body)), pw, expiryFrom(body.expiresDays), new Date().toISOString())
        return send(res, 201, toShare(q.get.get(token)))
      }
      const m = sub.match(/^\/([A-Za-z0-9_-]{22})$/)
      if (!m) throw new HttpError(404, 'Unbekannte Adresse')
      const row = q.get.get(m[1])
      if (!row || row.space !== group.space) throw new HttpError(404, 'Link nicht gefunden.')
      if (req.method === 'PATCH') {
        const body = await readJson(req)
        const opts = cleanOptions(body, JSON.parse(row.options))
        let pw = row.pw_hash
        if (body.password === '' || body.password === null) pw = null
        else if (typeof body.password === 'string') pw = hashPassword(body.password.slice(0, 200))
        const expires = 'expiresDays' in body ? expiryFrom(body.expiresDays) : row.expires
        const revoked = typeof body.revoked === 'boolean' ? (body.revoked ? 1 : 0) : row.revoked
        q.update.run(JSON.stringify(opts), pw, expires, revoked, row.token, group.space)
        return send(res, 200, toShare(q.get.get(row.token)))
      }
      if (req.method === 'DELETE') {
        q.remove.run(row.token, group.space)
        return send(res, 200, { ok: true })
      }
      throw new HttpError(405, 'Nicht erlaubt')
    },

    /** Öffentlich (ohne Schlüssel): Inhalte und Fotos eines Links. */
    handlePublic(req, res, url, path) {
      const m = path.match(/^\/api\/public\/([^/]+)(?:\/photo\/([^/]+))?$/)
      if (!m || (req.method !== 'GET' && req.method !== 'HEAD')) throw new HttpError(404, 'Unbekannte Adresse')
      const [, token, photoId] = m

      if (!photoId) {
        const row = open(token, req, url)
        const data = content(row)
        q.access.run(new Date().toISOString(), token)
        const exp = Date.now() + TICKET_MS
        return send(res, 200, { ...data, ticket: row.pw_hash ? ticketFor(token, exp) : '' })
      }

      const row = open(token, req, url, { allowTicket: true })
      if (!allowedPhotoIds(row).has(photoId)) throw new HttpError(404, 'Foto nicht gefunden.')
      const photo = store.record(row.space, 'photos', photoId)
      const ref = url.searchParams.get('size') === 'thumb' ? photo?.thumb : photo?.full
      const meta = ref?.__blobRef ? store.blobMeta(row.space, ref.__blobRef) : null
      if (!meta) throw new HttpError(404, 'Foto ist noch nicht auf dem Server.')
      res.writeHead(200, {
        'Content-Type': meta.type,
        'Content-Length': String(meta.size),
        'Cache-Control': 'private, max-age=86400',
        'X-Content-Type-Options': 'nosniff'
      })
      if (req.method === 'HEAD') return res.end()
      return createReadStream(meta.path).pipe(res)
    }
  }
}
