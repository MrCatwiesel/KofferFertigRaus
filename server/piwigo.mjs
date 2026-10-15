/**
 * Piwigo-Brücke des Abgleich-Servers.
 *
 * Der Server spricht im Heimnetz mit Piwigo (Web-API ws.php) und reicht Alben und Fotos an die App weiter.
 * Vorteile: Der Piwigo-Schlüssel bleibt auf dem Server, die App braucht keine eigene Anmeldung,
 * und Piwigo muss weder CORS noch Cookies für fremde Seiten erlauben.
 *
 * Anmeldung mit einem Piwigo-API-Schlüssel (ab Piwigo 16.1): pwg.session.login mit
 * Schlüssel-ID (pkid-…) als Benutzername und Geheimnis als Passwort. Damit gilt die Sitzung
 * auch für die Bilddateien (i.php), die ein reiner API-Header nicht abdeckt.
 */
import { createHash } from 'node:crypto'

/** Bildgrößen von Piwigo (Derivate) plus Original. */
export const PIWIGO_SIZES = ['square', 'thumb', '2small', 'xsmall', 'small', 'medium', 'large', 'xlarge', 'xxlarge', 'original']

const KEY_ID_RE = /^pkid-\d{8}-[a-z0-9]{20}$/i

export class PiwigoError extends Error {
  constructor(message, status = 502) {
    super(message)
    this.status = status
  }
}

/**
 * @param {{ url: string, keyId: string, secret: string, publicUrl?: string, fetchImpl?: typeof fetch }} opts
 */
export function createPiwigoClient(opts) {
  const base = new URL(opts.url.endsWith('/') ? opts.url : `${opts.url}/`)
  const wsUrl = new URL('ws.php', base)
  const publicBase = opts.publicUrl ? new URL(opts.publicUrl.endsWith('/') ? opts.publicUrl : `${opts.publicUrl}/`) : null
  const doFetch = opts.fetchImpl ?? fetch
  if (!KEY_ID_RE.test(opts.keyId)) throw new Error('NWW_PIWIGO_KEY_ID muss die Form pkid-JJJJMMTT-… haben (Piwigo → Profil → API-Schlüssel).')
  if (!opts.secret) throw new Error('NWW_PIWIGO_SECRET fehlt.')

  /** @type {Map<string, string>} */
  let cookies = new Map()
  let token = ''
  let loginPromise = null
  /** Bild-ID → { derivatives, original } (aus Listen gemerkt, spart Abfragen) */
  const urlCache = new Map()

  const cookieHeader = () => [...cookies].map(([k, v]) => `${k}=${v}`).join('; ')

  function keepCookies(res) {
    const list = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
    for (const c of list) {
      const [pair] = c.split(';')
      const i = pair.indexOf('=')
      if (i > 0) cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim())
    }
  }

  async function rawCall(method, params = {}, { post = false, form = null } = {}) {
    const url = new URL(wsUrl)
    url.searchParams.set('format', 'json')
    url.searchParams.set('method', method)
    let body
    if (form) {
      body = form
    } else if (post) {
      body = new URLSearchParams()
      for (const [k, v] of Object.entries(params)) {
        if (Array.isArray(v)) v.forEach((x) => body.append(`${k}[]`, String(x)))
        else if (v !== undefined && v !== null) body.append(k, String(v))
      }
    } else {
      for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
    }
    let res
    try {
      res = await doFetch(url, {
        method: post || form ? 'POST' : 'GET',
        headers: { Cookie: cookieHeader(), Accept: 'application/json' },
        body
      })
    } catch {
      throw new PiwigoError('Piwigo ist nicht erreichbar – Adresse prüfen.')
    }
    keepCookies(res)
    const text = await res.text()
    let json
    try {
      json = JSON.parse(text)
    } catch {
      throw new PiwigoError(`Piwigo antwortet nicht wie erwartet (HTTP ${res.status}).`)
    }
    return json
  }

  async function login() {
    cookies = new Map()
    const r = await rawCall('pwg.session.login', { username: opts.keyId, password: opts.secret }, { post: true })
    if (r.stat !== 'ok') throw new PiwigoError('Anmeldung bei Piwigo fehlgeschlagen – API-Schlüssel prüfen (abgelaufen oder widerrufen?).')
    const s = await rawCall('pwg.session.getStatus')
    if (s.stat !== 'ok' || !s.result || s.result.status === 'guest') throw new PiwigoError('Piwigo-Anmeldung ohne Wirkung.')
    token = s.result.pwg_token ?? ''
    return s.result
  }

  async function ensureLogin() {
    if (token) return
    loginPromise ??= login().finally(() => (loginPromise = null))
    await loginPromise
  }

  /** API-Aufruf mit Anmeldung; bei abgelaufener Sitzung einmal neu anmelden. */
  async function call(method, params = {}, options = {}) {
    await ensureLogin()
    const withToken = options.post || options.form ? { ...params, pwg_token: token } : params
    if (options.form) options.form.set('pwg_token', token)
    let r = await rawCall(method, withToken, options)
    if (r.stat !== 'ok' && (r.err === 401 || r.err === 403)) {
      token = ''
      await ensureLogin()
      if (options.form) options.form.set('pwg_token', token)
      r = await rawCall(method, options.post || options.form ? { ...params, pwg_token: token } : params, options)
    }
    if (r.stat !== 'ok') throw new PiwigoError(`Piwigo: ${r.message || 'Fehler'} (${method})`, r.err === 401 || r.err === 403 ? 403 : 502)
    return r.result
  }

  /** Piwigo-Adresse (intern) → öffentliche Adresse für Links in der App. */
  function publicLink(u) {
    if (!u) return ''
    if (!publicBase) return u
    try {
      const x = new URL(u, base)
      const rel = x.pathname.startsWith(base.pathname) ? x.pathname.slice(base.pathname.length) : x.pathname.replace(/^\//, '')
      return new URL(rel + x.search, publicBase).href
    } catch {
      return u
    }
  }

  function rememberUrls(img) {
    const derivatives = {}
    for (const [k, v] of Object.entries(img.derivatives ?? {})) if (v?.url) derivatives[k] = v.url
    urlCache.set(String(img.id), { derivatives, original: img.element_url ?? '' })
    if (urlCache.size > 5000) urlCache.delete(urlCache.keys().next().value)
  }

  function mapImage(img) {
    rememberUrls(img)
    return {
      id: Number(img.id),
      name: img.name ?? img.file ?? '',
      file: img.file ?? '',
      width: Number(img.width) || 0,
      height: Number(img.height) || 0,
      takenAt: img.date_creation ?? img.date_available ?? '',
      comment: img.comment ?? '',
      pageUrl: publicLink(img.page_url)
    }
  }

  /** Nur Adressen auf dem eigenen Piwigo abrufen (keine Weiterleitung auf fremde Server). */
  function sameServer(u) {
    const x = new URL(u, base)
    return new URL(x.pathname + x.search, base.origin)
  }

  return {
    async status() {
      const s = await login()
      return { user: s.username, admin: s.status === 'admin' || s.status === 'webmaster', version: s.version ?? '', publicUrl: publicBase?.href ?? '' }
    },

    async albums() {
      const r = await call('pwg.categories.getList', { recursive: true, fullname: true })
      return (r.categories ?? []).map((c) => ({
        id: Number(c.id),
        name: c.name ?? '',
        parentId: c.id_uppercat ? Number(c.id_uppercat) : null,
        images: Number(c.nb_images) || 0,
        totalImages: Number(c.total_nb_images) || 0,
        url: publicLink(c.url)
      }))
    },

    async createAlbum(name, parentId) {
      const clean = String(name ?? '').trim().slice(0, 200)
      if (!clean) throw new PiwigoError('Albumname fehlt.', 400)
      const r = await call('pwg.categories.add', { name: clean, parent: parentId || undefined, status: 'private' }, { post: true })
      return { id: Number(r.id), name: clean }
    },

    async images(albumId, page = 0, perPage = 60) {
      const r = await call('pwg.categories.getImages', { cat_id: albumId, page, per_page: perPage, order: 'date_creation asc' })
      const paging = r.paging ?? {}
      return {
        images: (r.images ?? []).map(mapImage),
        page: Number(paging.page) || page,
        perPage: Number(paging.per_page) || perPage,
        total: Number(paging.total_count) || (r.images ?? []).length
      }
    },

    /** Bilddatei holen (Sitzung des Servers) – liefert die Antwort von Piwigo zum Weiterreichen. */
    async image(id, size) {
      if (!PIWIGO_SIZES.includes(size)) throw new PiwigoError('Unbekannte Bildgröße.', 400)
      let urls = urlCache.get(String(id))
      if (!urls) {
        const info = await call('pwg.images.getInfo', { image_id: id })
        rememberUrls(info)
        urls = urlCache.get(String(id))
      }
      const target = size === 'original' ? urls.original : urls.derivatives[size] ?? urls.derivatives.xxlarge ?? urls.original
      if (!target) throw new PiwigoError('Bild nicht gefunden.', 404)
      await ensureLogin()
      const fetchIt = () => doFetch(sameServer(target), { headers: { Cookie: cookieHeader() } })
      let res = await fetchIt().catch(() => null)
      if (res && (res.status === 401 || res.status === 403)) {
        token = ''
        await ensureLogin()
        res = await fetchIt().catch(() => null)
      }
      if (!res) throw new PiwigoError('Piwigo ist nicht erreichbar.')
      if (!res.ok) throw new PiwigoError(`Bild nicht verfügbar (HTTP ${res.status}).`, res.status === 404 ? 404 : 502)
      return res
    },

    /**
     * Foto hochladen. Schon vorhandene Fotos (gleiche Prüfsumme) werden nicht doppelt angelegt –
     * so schadet ein zweiter Versuch nach einem Abbruch nicht.
     */
    async upload(albumId, data, { filename = 'foto.jpg', type = 'image/jpeg', name = '', comment = '' } = {}) {
      const md5 = createHash('md5').update(data).digest('hex')
      const exist = await call('pwg.images.exist', { md5sum_list: md5 }, { post: true })
      const existing = exist?.[md5]
      if (existing) {
        const id = Number(existing)
        await call('pwg.images.setInfo', { image_id: id, categories: String(albumId), multiple_value_mode: 'append' }, { post: true }).catch(() => {})
        return { id, existed: true }
      }
      const form = new FormData()
      form.set('image', new Blob([data], { type }), filename.replace(/[^\w.\-]+/g, '_').slice(0, 120) || 'foto.jpg')
      form.set('category', String(albumId))
      if (name) form.set('name', String(name).slice(0, 255))
      if (comment) form.set('comment', String(comment).slice(0, 2000))
      const r = await call('pwg.images.addSimple', {}, { form })
      return { id: Number(r.image_id), existed: false, pageUrl: publicLink(r.url) }
    }
  }
}
