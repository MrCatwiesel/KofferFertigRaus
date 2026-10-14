/**
 * Lese-Links: eine Reise für Freunde zum Ansehen freigeben – ohne Schlüssel, ohne Änderungsrecht.
 *
 * Herausgegeben wird nur, was ausdrücklich dazugehört: Reise-Eckdaten (Titel, Ziel, Zeitraum),
 * Tagebucheinträge (alle oder nur Highlights) und deren Fotos, freigegebene Routen und – wenn gewählt –
 * Unterkünfte (Name, Art, Zeitraum, auf Wunsch Adresse/Link) und Unternehmungen (Titel, Art, Tag, Ort).
 * Budget, Preise, Buchungsnummern, Ausgaben, Apotheke, Dokumente, Notfallnummern, Notizen und
 * Mitreisende bleiben immer privat.
 */
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { HttpError, blobHeaders, readJson, send } from './http.mjs'
import { clientIp } from './devices.mjs'

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

const finite = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_ROUTE_POINTS = 600

/** Route für Lese-Links: nur Name, Farbe, Tag, Kennzahlen und vereinfachte Punkte (keine Notizen, keine Originaldatei). */
function publicRoute(r) {
  const pts = Array.isArray(r.preview) ? r.preview : []
  const step = Math.max(1, Math.ceil(pts.length / MAX_ROUTE_POINTS))
  const points = pts
    .filter((_, i) => i % step === 0 || i === pts.length - 1)
    .map((p) => [finite(p?.[0]), finite(p?.[1]), Number.isFinite(p?.[2]) ? Number(p[2]) : null])
    .filter((p) => Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180)
  const st = r.stats ?? {}
  return {
    name: String(r.name ?? '').slice(0, 120),
    color: /^#[0-9a-f]{6}$/i.test(r.color ?? '') ? r.color : '#e11d48',
    kind: r.kind === 'route' ? 'route' : 'track',
    date: DATE_RE.test(r.date ?? '') ? r.date : '',
    stats: { distance: finite(st.distance), ascent: finite(st.ascent), descent: finite(st.descent), duration: Number.isFinite(st.duration) ? st.duration : null },
    points
  }
}

const str = (v, max) => String(v ?? '').trim().slice(0, max)
const date = (v) => (DATE_RE.test(v ?? '') ? v : '')

/** Wie in der App (website/sections.ts): nie stornierte; gibt es gebuchte, nur die gebuchten. */
function chooseStays(list) {
  const live = list.filter((s) => s.status !== 'storniert')
  return live.some((s) => s.status === 'gebucht') ? live.filter((s) => s.status === 'gebucht') : live
}
function chooseActivities(list) {
  const done = list.filter((a) => a.status === 'erledigt')
  return done.length ? done : list.filter((a) => a.status === 'geplant')
}

/** Unterkunft für Lese-Links: ausdrücklich nur diese Felder – nie Preis, Buchungsnummer, Storno-Frist, Notizen. */
function publicStay(a, details) {
  const url = str(a.url, 500)
  return {
    name: str(a.name, 120),
    type: /^[a-z]{1,20}$/.test(a.type ?? '') ? a.type : 'sonstiges',
    checkIn: date(a.checkIn),
    checkOut: date(a.checkOut),
    address: details ? str(a.address, 200) : '',
    url: details && /^https?:\/\/[^\s"'<>]+$/i.test(url) ? url : ''
  }
}

function publicActivity(a, withPlace) {
  return {
    title: str(a.title, 120),
    category: /^[a-z]{1,20}$/.test(a.category ?? '') ? a.category : 'sonstiges',
    date: date(a.plannedDate),
    place: withPlace ? str(a.place, 120) : ''
  }
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
    routes: typeof body.routes === 'boolean' ? body.routes : old.routes ?? true,
    stays: typeof body.stays === 'boolean' ? body.stays : old.stays ?? false,
    stayDetails: typeof body.stayDetails === 'boolean' ? body.stayDetails : old.stayDetails ?? false,
    activities: typeof body.activities === 'boolean' ? body.activities : old.activities ?? false,
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

export function createShares(store, groups = null) {
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
    // Gesperrte oder gelöschte Reisegruppe: ihre Links gelten nicht mehr
    if (groups && !groups.get(row.space) || groups?.get(row.space)?.disabled) throw new HttpError(410, 'Dieser Link gilt nicht mehr.')
    if (row.pw_hash) {
      if (allowTicket && ticketValid(token, url.searchParams.get('t'))) return row
      // Fehlversuche je Link und Gegenstelle – wer falsch rät, sperrt nur sich selbst aus
      const fk = `${token}|${clientIp(req)}`
      const f = fails.get(fk)
      if (f && f.until > Date.now()) throw new HttpError(429, 'Zu viele Versuche – bitte kurz warten.')
      const pw = req.headers['x-share-password']
      if (!pw) throw new HttpError(401, 'Passwort nötig.', { needPassword: true })
      if (!checkPassword(pw, row.pw_hash)) {
        const n = (f?.n ?? 0) + 1
        fails.set(fk, { n, until: n >= 5 ? Date.now() + 60_000 * (n - 4) : 0 })
        if (fails.size > 5000) fails.delete(fails.keys().next().value)
        throw new HttpError(401, 'Passwort falsch.', { needPassword: true })
      }
      fails.delete(fk)
    }
    return row
  }

  /** Was der Link zeigt – streng gefiltert. */
  function content(row) {
    const opts = JSON.parse(row.options)
    const trip = store.record(row.space, 'trips', row.trip_id)
    if (!trip) throw new HttpError(404, 'Diese Reise gibt es nicht mehr.')
    const site = store.record(row.space, 'websites', row.trip_id)
    const look = opts.look ?? cleanLook(site) ?? cleanLook({})
    const photos = new Map(opts.photos ? store.byTrip(row.space, 'photos', row.trip_id).map((p) => [p.id, p]) : [])
    const entries = store
      .byTrip(row.space, 'journalEntries', row.trip_id)
      .filter((e) => opts.mode === 'journal' || e.highlight)
      .map((e) => ({
        date: String(e.date ?? ''),
        title: String(e.title ?? ''),
        text: String(e.text ?? ''),
        mood: Number(e.mood) || 0,
        location: look.showLocation ? String(e.location ?? '') : '',
        highlight: !!e.highlight,
        createdAt: String(e.createdAt ?? ''),
        photos: (e.photoIds ?? [])
          .map((id) => photos.get(id))
          .filter(Boolean)
          .map((p) => ({ id: p.id, width: Number(p.width) || 0, height: Number(p.height) || 0, caption: String(p.caption ?? '') }))
      }))
    const routes = opts.routes === false ? [] : store.byTrip(row.space, 'routes', row.trip_id).filter((r) => r.showInShare).map(publicRoute).filter((r) => r.points.length >= 2)
    const stays = opts.stays ? chooseStays(store.byTrip(row.space, 'accommodations', row.trip_id)).map((a) => publicStay(a, !!opts.stayDetails)).filter((a) => a.name) : []
    const activities = opts.activities
      ? chooseActivities(store.byTrip(row.space, 'activities', row.trip_id)).map((a) => publicActivity(a, look.showLocation)).filter((a) => a.title)
      : []
    return {
      title: opts.title || site?.title || trip.title || 'Reise',
      subtitle: site?.subtitle || trip.destination || '',
      intro: site?.intro || '',
      author: site?.author || '',
      trip: { destination: String(trip.destination ?? ''), startDate: String(trip.startDate ?? ''), endDate: String(trip.endDate ?? '') },
      mode: opts.mode,
      look,
      entries,
      routes,
      stays,
      activities
    }
  }

  /** Fotos dieses Links: nur aus den freigegebenen Einträgen (kurz zwischengespeichert – eine Galerie fragt viele Fotos ab). */
  const photoCache = new Map()
  function allowedPhotoIds(row) {
    const hit = photoCache.get(row.token)
    if (hit && hit.at > Date.now() - 60_000) return hit.ids
    const ids = new Set(content(row).entries.flatMap((e) => e.photos.map((p) => p.id)))
    if (photoCache.size > 500) photoCache.delete(photoCache.keys().next().value)
    photoCache.set(row.token, { at: Date.now(), ids })
    return ids
  }

  return {
    /** Verwaltung durch die Reisegruppe (mit Schlüssel). */
    /**
     * Verwaltung der Links. `guard(tripId, need)` (Personen mit Rechten): darf die Reise sehen ('lesen')
     * bzw. bearbeiten ('bearbeiten')? Ohne guard: voller Zugriff.
     */
    async handleOwner(req, res, url, path, group, guard = null) {
      const sub = path.slice('/api/shares'.length)
      const need = (tripId, kind) => {
        if (guard && !guard(tripId, kind)) throw new HttpError(403, 'Für diese Reise hast du kein Recht dazu.')
      }
      if (sub === '' && req.method === 'GET') {
        const tripId = url.searchParams.get('tripId')
        const rows = q.list.all(group.space, tripId, tripId).filter((r) => !guard || guard(r.trip_id, 'lesen'))
        return send(res, 200, { shares: rows.map(toShare) })
      }
      if (sub === '' && req.method === 'POST') {
        const body = await readJson(req)
        if (typeof body.tripId !== 'string' || !body.tripId) throw new HttpError(400, 'tripId fehlt.')
        need(body.tripId, 'bearbeiten')
        if (!store.record(group.space, 'trips', body.tripId)) throw new HttpError(400, 'Reise ist noch nicht auf dem Server – erst abgleichen.')
        const token = newToken()
        const pw = typeof body.password === 'string' && body.password ? hashPassword(body.password.slice(0, 200)) : null
        q.insert.run(token, group.space, body.tripId, JSON.stringify(cleanOptions(body)), pw, expiryFrom(body.expiresDays), new Date().toISOString())
        return send(res, 201, toShare(q.get.get(token)))
      }
      const m = sub.match(/^\/([A-Za-z0-9_-]{22})$/)
      if (!m) throw new HttpError(404, 'Unbekannte Adresse')
      const row = q.get.get(m[1])
      if (!row || row.space !== group.space || (guard && !guard(row.trip_id, 'lesen'))) throw new HttpError(404, 'Link nicht gefunden.')
      need(row.trip_id, 'bearbeiten')
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
      // Öffentlich nur echte Bilder ausliefern – nie etwas, das der Browser als Seite ausführen würde
      if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(meta.type)) throw new HttpError(404, 'Foto nicht gefunden.')
      res.writeHead(200, { ...blobHeaders(meta.type, meta.size), 'Cache-Control': 'private, max-age=86400' })
      if (req.method === 'HEAD') return res.end()
      return createReadStream(meta.path).pipe(res)
    }
  }
}
