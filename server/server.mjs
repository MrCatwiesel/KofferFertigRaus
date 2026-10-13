/**
 * Nix wie weg – Abgleich-Server
 *
 * Ein kleiner Server ohne Fremdpakete (nur Node.js ≥ 22.13), der die Daten mehrerer Geräte abgleicht.
 *  - Daten: SQLite-Datei (eingebaut in Node.js), Fotos als einzelne Dateien        → store.mjs
 *  - Zugang: geheimer Schlüssel je Reisegruppe, Gruppen-Verwaltung durch den Besitzer → groups.mjs
 *  - Geräte-Anmeldung: eigener Zugang je Gerät, Einladungen, Abmelden                → devices.mjs
 *  - Lese-Links: Reisen für Freunde zum Ansehen freigeben                            → shares.mjs
 *  - Piwigo-Brücke (optional)                                                        → piwigo.mjs
 *  - Die App selbst ausliefern (optional, NWW_APP_DIR)                               → static.mjs
 *  - Wanderwege-Suche (Overpass) und Routenplaner (BRouter) weitergereicht          → routing.mjs
 *  - Reisehinweise des Auswärtigen Amts weitergereicht (zwischengespeichert)        → reiseinfo.mjs
 *  - Offline-Karten: Ausschnitte der Protomaps-Weltkarte (optional, Programm pmtiles) → maps.mjs
 *  - Regel: pro Datensatz gewinnt die neuere Änderung (Zeitstempel), Löschungen werden mit übertragen
 *
 * Start:  NWW_KEYS=<schlüssel> node server.mjs
 */
import { createServer as createHttpServer } from 'node:http'
import { createReadStream } from 'node:fs'
import { resolve } from 'node:path'
import { Readable } from 'node:stream'
import { pathToFileURL } from 'node:url'
import { HttpError, corsFor, readBody, readJson, send } from './http.mjs'
import { HASH_RE, createStore, sha256 } from './store.mjs'
import { createGroups } from './groups.mjs'
import { createShares } from './shares.mjs'
import { createStatic } from './static.mjs'
import { createPiwigoClient } from './piwigo.mjs'
import { createMaps } from './maps.mjs'
import { createDevices } from './devices.mjs'
import { createBackupAdmin } from './backup-targets.mjs'
import { createRouting } from './routing.mjs'
import { createReiseinfo } from './reiseinfo.mjs'

export { spaceOf } from './store.mjs'
export const VERSION = '1.12.0'

const MAX_JSON = 30 * 1024 * 1024

/**
 * Erzeugt den Server (für Start und Tests).
 * @param {{ keys: string[], dataDir: string, origins?: string[], maxBlobMb?: number,
 *   piwigo?: { url: string, keyId: string, secret: string, publicUrl?: string, fetchImpl?: typeof fetch } | null,
 *   appDir?: string | null, deviceIdleDays?: number, routing?: { overpassUrl?: string, brouterUrl?: string, fetchImpl?: typeof fetch }, reiseinfo?: { url?: string, fetchImpl?: typeof fetch }, maps?: { bin?: string, source?: string, fetchImpl?: typeof fetch } }} opts
 */
export function createSyncServer(opts) {
  const store = createStore(resolve(opts.dataDir))
  let groups
  try {
    groups = createGroups(store, opts.keys)
  } catch (e) {
    store.close()
    throw e
  }
  const shares = createShares(store)
  const devices = createDevices(store, groups, { idleDays: opts.deviceIdleDays })
  const backupAdmin = createBackupAdmin(resolve(opts.dataDir))
  const routing = createRouting({ ...(opts.routing ?? {}), version: VERSION })
  const reiseinfo = createReiseinfo({ ...(opts.reiseinfo ?? {}), version: VERSION })
  const app = opts.appDir ? createStatic(opts.appDir) : null
  const piwigo = opts.piwigo?.url ? createPiwigoClient(opts.piwigo) : null
  const maps = createMaps(resolve(opts.dataDir), opts.maps ?? {})
  const cors = corsFor(opts.origins)
  const maxBlob = (opts.maxBlobMb ?? 30) * 1024 * 1024

  async function handle(req, res) {
    cors(req, res)
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      return res.end()
    }
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname.replace(/\/+$/, '')

    if (req.method === 'GET' && (path === '/api/health' || (path === '' && !app))) {
      return send(res, 200, { ok: true, app: 'nix-wie-weg-sync', version: VERSION, appHosted: !!app, shares: true })
    }

    // Öffentlich: Lese-Links (ohne Schlüssel, streng gefiltert)
    if (path.startsWith('/api/public/')) return shares.handlePublic(req, res, url, path)

    // Die App selbst (gebaute Dateien), wenn NWW_APP_DIR gesetzt ist
    if (app && (req.method === 'GET' || req.method === 'HEAD') && !path.startsWith('/api/')) {
      return app.serve(req, res, url.pathname)
    }

    // Gerät anmelden (mit Einladungscode oder Gruppenschlüssel) → eigener Gerätezugang
    if (path === '/api/anmelden') return devices.login(req, res)

    const auth = devices.authenticate(req)
    const { group } = auth
    const { space } = group
    if (!auth.device && (path === '/api/push' || path === '/api/pull')) devices.noteKeyUse(space)

    if (req.method === 'GET' && path === '/api/info') {
      const { records, seq } = store.info(space)
      return send(res, 200, {
        ok: true,
        version: VERSION,
        records,
        seq,
        // Kennung des Datenbestands: ändert sich nach dem Zurückspielen einer Sicherung (restore.sh)
        // → die Geräte gleichen dann einmal vollständig ab, damit nichts verloren geht
        epoch: store.secret('sync-epoch').slice(0, 16),
        piwigo: !!piwigo && group.piwigo,
        maps: maps.available,
        devices: true,
        device: auth.device,
        group: group.name,
        admin: group.owner,
        shares: true
      })
    }

    if (req.method === 'POST' && path === '/api/push') {
      const body = JSON.parse((await readBody(req, MAX_JSON)).toString('utf8') || '{}')
      if (!Array.isArray(body.changes)) throw new HttpError(400, 'changes fehlt')
      const result = store.push(space, body.changes)
      if (auth.device) devices.noteSync(auth.device.id, req)
      return send(res, 200, result)
    }

    if (req.method === 'GET' && path === '/api/pull') {
      const since = Math.max(0, Number(url.searchParams.get('since') ?? 0) || 0)
      const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit') ?? 500) || 500))
      const page = store.pull(space, since, limit)
      // Letzte Seite geholt → Gerät ist auf Stand `seq` (bzw. auf dem aktuellen Stand, wenn nichts Neues kam)
      if (auth.device) devices.noteSync(auth.device.id, req, page.more ? null : page.changes.length ? page.seq : store.info(space).seq)
      return send(res, 200, page)
    }

    const blob = path.match(/^\/api\/blob\/([a-f0-9]{64})$/)
    if (blob) return handleBlob(req, res, space, blob[1])

    if (path === '/api/shares' || path.startsWith('/api/shares/')) return shares.handleOwner(req, res, url, path, group)

    if (path === '/api/geraete' || path.startsWith('/api/geraete/') || path === '/api/einladungen') return devices.handle(req, res, path, auth)

    if (path.startsWith('/api/routing/')) return routing.handle(req, res, url, path)

    if (path.startsWith('/api/reiseinfo/')) return reiseinfo.handle(req, res, path)

    if (path === '/api/maps' || path.startsWith('/api/maps/')) return maps.handle(req, res, path, group)

    if (path === '/api/admin/sicherung' || path.startsWith('/api/admin/sicherung/')) {
      if (!group.owner) throw new HttpError(403, 'Nur der Besitzer des Servers verwaltet die Sicherung.')
      return backupAdmin.handle(req, res, path)
    }

    if (path === '/api/admin/groups' || path.startsWith('/api/admin/groups/')) {
      if (!group.owner) throw new HttpError(403, 'Nur der Besitzer des Servers darf Reisegruppen verwalten.')
      return handleGroups(req, res, path)
    }

    if (path === '/api/piwigo' || path.startsWith('/api/piwigo/')) {
      if (!piwigo) throw new HttpError(404, 'Piwigo ist auf dem Server nicht eingerichtet.')
      if (!group.piwigo) throw new HttpError(403, 'Piwigo ist für diese Reisegruppe nicht freigegeben.')
      return handlePiwigo(req, res, url, path)
    }

    throw new HttpError(404, 'Unbekannte Adresse')
  }

  async function handleBlob(req, res, space, hash) {
    const meta = store.blobMeta(space, hash)
    if (req.method === 'HEAD' || req.method === 'GET') {
      if (!meta) {
        res.writeHead(404)
        return res.end()
      }
      res.writeHead(200, {
        'Content-Type': meta.type,
        'Content-Length': String(meta.size),
        'Cache-Control': 'private, max-age=31536000, immutable'
      })
      if (req.method === 'HEAD') return res.end()
      return createReadStream(meta.path).pipe(res)
    }
    if (req.method === 'PUT') {
      if (meta) return send(res, 200, { ok: true, existed: true })
      const body = await readBody(req, maxBlob)
      if (!HASH_RE.test(hash) || sha256(body) !== hash) throw new HttpError(400, 'Prüfsumme stimmt nicht.')
      store.putBlob(space, hash, String(req.headers['content-type'] ?? 'application/octet-stream').slice(0, 100), body)
      return send(res, 201, { ok: true })
    }
    throw new HttpError(405, 'Nicht erlaubt')
  }

  /** Reisegruppen verwalten (nur Besitzer). */
  async function handleGroups(req, res, path) {
    const sub = path.slice('/api/admin/groups'.length)
    if (sub === '' && req.method === 'GET') return send(res, 200, { groups: groups.list() })
    if (sub === '' && req.method === 'POST') {
      const body = await readJson(req)
      return send(res, 201, groups.create(body.name, body.piwigo === true))
    }
    const m = sub.match(/^\/([a-f0-9]{24})$/)
    if (!m) throw new HttpError(404, 'Unbekannte Adresse')
    if (req.method === 'PATCH') {
      const body = await readJson(req)
      if (body.newKey === true) return send(res, 200, groups.rotateKey(m[1]))
      return send(res, 200, groups.update(m[1], body))
    }
    if (req.method === 'DELETE') {
      if (m[1] === groups.ownerSpace) throw new HttpError(400, 'Die eigene Gruppe kann nicht gelöscht werden.')
      groups.remove(m[1])
      maps.removeSpace(m[1])
      devices.removeSpace(m[1])
      return send(res, 200, { ok: true })
    }
    throw new HttpError(405, 'Nicht erlaubt')
  }

  /** Piwigo-Brücke: Alben, Fotos, Hochladen. */
  async function handlePiwigo(req, res, url, path) {
    const sub = path.slice('/api/piwigo'.length)

    if (req.method === 'GET' && sub === '') return send(res, 200, { ok: true, ...(await piwigo.status()) })

    if (sub === '/albums') {
      if (req.method === 'GET') return send(res, 200, { albums: await piwigo.albums() })
      if (req.method === 'POST') {
        const body = await readJson(req)
        return send(res, 201, await piwigo.createAlbum(body.name, Number(body.parentId) || undefined))
      }
    }

    const albumImages = sub.match(/^\/albums\/(\d+)\/images$/)
    if (albumImages) {
      const albumId = Number(albumImages[1])
      if (req.method === 'GET') {
        const page = Math.max(0, Number(url.searchParams.get('page') ?? 0) || 0)
        const perPage = Math.min(200, Math.max(1, Number(url.searchParams.get('perPage') ?? 60) || 60))
        return send(res, 200, await piwigo.images(albumId, page, perPage))
      }
      if (req.method === 'POST') {
        const data = await readBody(req, maxBlob)
        if (!data.length) throw new HttpError(400, 'Keine Bilddaten.')
        const type = String(req.headers['content-type'] ?? 'image/jpeg').slice(0, 100)
        if (!/^image\//.test(type)) throw new HttpError(400, 'Nur Bilder.')
        const result = await piwigo.upload(albumId, data, {
          type,
          filename: url.searchParams.get('filename') ?? 'foto.jpg',
          name: url.searchParams.get('name') ?? '',
          comment: url.searchParams.get('comment') ?? ''
        })
        return send(res, 201, result)
      }
    }

    const image = sub.match(/^\/images\/(\d+)$/)
    if (image && req.method === 'GET') {
      const upstream = await piwigo.image(Number(image[1]), url.searchParams.get('size') ?? 'medium')
      const headers = { 'Cache-Control': 'private, max-age=86400' }
      const type = upstream.headers.get('content-type')
      const length = upstream.headers.get('content-length')
      if (type) headers['Content-Type'] = type
      if (length) headers['Content-Length'] = length
      res.writeHead(200, headers)
      if (!upstream.body) return res.end()
      return Readable.fromWeb(upstream.body).pipe(res)
    }

    throw new HttpError(404, 'Unbekannte Adresse')
  }

  const server = createHttpServer((req, res) => {
    handle(req, res).catch((e) => {
      const status = e?.status ?? (e instanceof SyntaxError ? 400 : 500)
      if (status === 500) console.error(e)
      if (!res.headersSent) send(res, status, { error: status === 500 ? 'Serverfehler' : e.message, ...(e?.extra ?? {}) })
      else res.end()
    })
  })
  server.on('close', () => store.close())
  return server
}

// Direkter Start: node server.mjs
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const server = createSyncServer({
    keys: (process.env.NWW_KEYS ?? '').split(','),
    dataDir: process.env.NWW_DATA ?? './data',
    origins: (process.env.NWW_ORIGINS ?? '*').split(',').map((s) => s.trim()).filter(Boolean),
    maxBlobMb: Number(process.env.NWW_MAX_BLOB_MB ?? 30),
    piwigo: process.env.NWW_PIWIGO_URL
      ? {
          url: process.env.NWW_PIWIGO_URL,
          keyId: process.env.NWW_PIWIGO_KEY_ID ?? '',
          secret: process.env.NWW_PIWIGO_SECRET ?? '',
          publicUrl: process.env.NWW_PIWIGO_PUBLIC_URL || undefined
        }
      : null,
    appDir: process.env.NWW_APP_DIR || null,
    routing: { overpassUrl: process.env.NWW_OVERPASS_URL || undefined, brouterUrl: process.env.NWW_BROUTER_URL || undefined },
    reiseinfo: { url: process.env.NWW_AA_URL || undefined },
    deviceIdleDays: process.env.NWW_DEVICE_IDLE_DAYS ? Number(process.env.NWW_DEVICE_IDLE_DAYS) : undefined,
    maps: { bin: process.env.NWW_PMTILES || undefined, source: process.env.NWW_MAPS_SOURCE || undefined }
  })
  const port = Number(process.env.PORT ?? 8787)
  const host = process.env.NWW_HOST || undefined // z. B. 127.0.0.1, wenn nginx im selben Container läuft
  server.listen(port, host, () => console.log(`Nix wie weg – Abgleich-Server ${VERSION} läuft auf ${host ?? '*'}:${port}`))
  const stop = () => server.close(() => process.exit(0))
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
}
