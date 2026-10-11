/**
 * Nix wie weg – Abgleich-Server
 *
 * Ein kleiner Server ohne Fremdpakete (nur Node.js ≥ 22.13), der die Daten mehrerer Geräte abgleicht.
 *  - Daten: SQLite-Datei (eingebaut in Node.js), Fotos als einzelne Dateien
 *  - Zugang: geheimer Schlüssel je Reisegruppe (Umgebungsvariable NWW_KEYS)
 *  - Regel: pro Datensatz gewinnt die neuere Änderung (Zeitstempel), Löschungen werden mit übertragen
 *
 * Start:  NWW_KEYS=<schlüssel> node server.mjs
 */
import { createServer as createHttpServer } from 'node:http'
import { createHash, timingSafeEqual } from 'node:crypto'
import { mkdirSync, existsSync, createReadStream, renameSync, writeFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { pathToFileURL } from 'node:url'
import { Readable } from 'node:stream'
import { createPiwigoClient } from './piwigo.mjs'

export const VERSION = '1.1.0'

const TABLE_RE = /^[a-zA-Z][a-zA-Z0-9]{0,39}$/
const HASH_RE = /^[a-f0-9]{64}$/
const MAX_JSON = 30 * 1024 * 1024

const sha256 = (data) => createHash('sha256').update(data).digest('hex')

/** Raum (Datenbereich) einer Reisegruppe: aus dem Schlüssel abgeleitet, der Schlüssel selbst wird nie gespeichert. */
export const spaceOf = (key) => sha256(`nix-wie-weg:${key}`).slice(0, 24)

function openDb(dir) {
  const db = new DatabaseSync(join(dir, 'nix-wie-weg.sqlite'))
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS records (
      space TEXT NOT NULL, tbl TEXT NOT NULL, id TEXT NOT NULL,
      stamp TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, data TEXT,
      seq INTEGER NOT NULL,
      PRIMARY KEY (space, tbl, id)
    );
    CREATE INDEX IF NOT EXISTS records_seq ON records (space, seq);
    CREATE TABLE IF NOT EXISTS counters (space TEXT PRIMARY KEY, seq INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS blobs (
      space TEXT NOT NULL, hash TEXT NOT NULL, type TEXT NOT NULL, size INTEGER NOT NULL,
      PRIMARY KEY (space, hash)
    );
  `)
  return db
}

/**
 * Erzeugt den Server (für Start und Tests).
 * @param {{ keys: string[], dataDir: string, origins?: string[], maxBlobMb?: number,
 *   piwigo?: { url: string, keyId: string, secret: string, publicUrl?: string, fetchImpl?: typeof fetch } | null }} opts
 */
export function createSyncServer(opts) {
  const keys = (opts.keys ?? []).map((k) => k.trim()).filter(Boolean)
  if (!keys.length) throw new Error('Kein Schlüssel konfiguriert (NWW_KEYS).')
  const short = keys.find((k) => k.length < 16)
  if (short) throw new Error('Schlüssel müssen mindestens 16 Zeichen lang sein.')
  const keyDigests = keys.map((k) => createHash('sha256').update(k).digest())
  const origins = opts.origins?.length ? opts.origins : ['*']
  const maxBlob = (opts.maxBlobMb ?? 30) * 1024 * 1024
  const dataDir = resolve(opts.dataDir)
  mkdirSync(join(dataDir, 'blobs'), { recursive: true })
  const db = openDb(dataDir)
  const piwigo = opts.piwigo?.url ? createPiwigoClient(opts.piwigo) : null

  const q = {
    get: db.prepare('SELECT stamp FROM records WHERE space = ? AND tbl = ? AND id = ?'),
    upsert: db.prepare(`INSERT INTO records (space, tbl, id, stamp, deleted, data, seq) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (space, tbl, id) DO UPDATE SET stamp = excluded.stamp, deleted = excluded.deleted, data = excluded.data, seq = excluded.seq`),
    nextSeq: db.prepare(`INSERT INTO counters (space, seq) VALUES (?, 1)
      ON CONFLICT (space) DO UPDATE SET seq = seq + 1 RETURNING seq`),
    pull: db.prepare('SELECT seq, tbl, id, stamp, deleted, data FROM records WHERE space = ? AND seq > ? ORDER BY seq LIMIT ?'),
    maxSeq: db.prepare('SELECT seq FROM counters WHERE space = ?'),
    count: db.prepare('SELECT COUNT(*) AS n FROM records WHERE space = ? AND deleted = 0'),
    blobGet: db.prepare('SELECT type, size FROM blobs WHERE space = ? AND hash = ?'),
    blobPut: db.prepare('INSERT OR IGNORE INTO blobs (space, hash, type, size) VALUES (?, ?, ?, ?)')
  }

  /** Prüft den Schlüssel (zeitkonstant) und liefert den Datenbereich – oder null. */
  function authenticate(req) {
    const h = req.headers.authorization ?? ''
    const m = h.match(/^Bearer\s+(.+)$/i)
    if (!m) return null
    const digest = createHash('sha256').update(m[1].trim()).digest()
    for (let i = 0; i < keyDigests.length; i++) {
      if (timingSafeEqual(digest, keyDigests[i])) return spaceOf(keys[i])
    }
    return null
  }

  function cors(req, res) {
    const origin = req.headers.origin
    const allow = origins.includes('*') ? '*' : origin && origins.includes(origin) ? origin : ''
    if (allow) res.setHeader('Access-Control-Allow-Origin', allow)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, HEAD, OPTIONS')
    res.setHeader('Access-Control-Max-Age', '86400')
  }

  function send(res, status, body) {
    const json = JSON.stringify(body)
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' })
    res.end(json)
  }

  function readBody(req, limit) {
    return new Promise((resolveBody, reject) => {
      const chunks = []
      let size = 0
      req.on('data', (c) => {
        size += c.length
        if (size > limit) {
          reject(Object.assign(new Error('Zu groß'), { status: 413 }))
          req.destroy()
          return
        }
        chunks.push(c)
      })
      req.on('end', () => resolveBody(Buffer.concat(chunks)))
      req.on('error', reject)
    })
  }

  /** Übernimmt Änderungen der Geräte – neuere gewinnt. */
  function push(space, changes) {
    let accepted = 0
    let ignored = 0
    db.exec('BEGIN')
    try {
      for (const c of changes) {
        if (!c || !TABLE_RE.test(c.tbl) || typeof c.id !== 'string' || !c.id || c.id.length > 200) throw Object.assign(new Error('Ungültige Änderung'), { status: 400 })
        if (typeof c.stamp !== 'string' || !c.stamp || c.stamp.length > 40) throw Object.assign(new Error('Ungültiger Zeitstempel'), { status: 400 })
        const existing = q.get.get(space, c.tbl, c.id)
        if (existing && existing.stamp >= c.stamp) {
          ignored++
          continue
        }
        const seq = q.nextSeq.get(space).seq
        q.upsert.run(space, c.tbl, c.id, c.stamp, c.deleted ? 1 : 0, c.deleted ? null : JSON.stringify(c.data ?? null), seq)
        accepted++
      }
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
    return { accepted, ignored, seq: q.maxSeq.get(space)?.seq ?? 0 }
  }

  function pull(space, since, limit) {
    const rows = q.pull.all(space, since, limit + 1)
    const more = rows.length > limit
    const changes = rows.slice(0, limit).map((r) => ({
      seq: r.seq,
      tbl: r.tbl,
      id: r.id,
      stamp: r.stamp,
      deleted: !!r.deleted,
      data: r.data ? JSON.parse(r.data) : null
    }))
    return { changes, more, seq: changes.at(-1)?.seq ?? since }
  }

  function blobPath(space, hash) {
    return join(dataDir, 'blobs', space, hash)
  }

  async function handle(req, res) {
    cors(req, res)
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      return res.end()
    }
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname.replace(/\/+$/, '')

    if (req.method === 'GET' && (path === '' || path === '/api/health')) {
      return send(res, 200, { ok: true, app: 'nix-wie-weg-sync', version: VERSION })
    }

    const space = authenticate(req)
    if (!space) return send(res, 401, { error: 'Schlüssel fehlt oder ist falsch.' })

    if (req.method === 'GET' && path === '/api/info') {
      return send(res, 200, { ok: true, version: VERSION, records: q.count.get(space).n, seq: q.maxSeq.get(space)?.seq ?? 0, piwigo: !!piwigo })
    }

    if (req.method === 'POST' && path === '/api/push') {
      const body = JSON.parse((await readBody(req, MAX_JSON)).toString('utf8') || '{}')
      if (!Array.isArray(body.changes)) return send(res, 400, { error: 'changes fehlt' })
      return send(res, 200, push(space, body.changes))
    }

    if (req.method === 'GET' && path === '/api/pull') {
      const since = Math.max(0, Number(url.searchParams.get('since') ?? 0) || 0)
      const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get('limit') ?? 500) || 500))
      return send(res, 200, pull(space, since, limit))
    }

    const blob = path.match(/^\/api\/blob\/([a-f0-9]{64})$/)
    if (blob) {
      const hash = blob[1]
      const meta = q.blobGet.get(space, hash)
      if (req.method === 'HEAD' || req.method === 'GET') {
        if (!meta || !existsSync(blobPath(space, hash))) {
          res.writeHead(404)
          return res.end()
        }
        res.writeHead(200, {
          'Content-Type': meta.type,
          'Content-Length': String(meta.size),
          'Cache-Control': 'private, max-age=31536000, immutable'
        })
        if (req.method === 'HEAD') return res.end()
        return createReadStream(blobPath(space, hash)).pipe(res)
      }
      if (req.method === 'PUT') {
        if (meta) return send(res, 200, { ok: true, existed: true })
        const body = await readBody(req, maxBlob)
        if (!HASH_RE.test(hash) || sha256(body) !== hash) return send(res, 400, { error: 'Prüfsumme stimmt nicht.' })
        const type = String(req.headers['content-type'] ?? 'application/octet-stream').slice(0, 100)
        mkdirSync(join(dataDir, 'blobs', space), { recursive: true })
        const tmp = `${blobPath(space, hash)}.tmp-${process.pid}-${Date.now()}`
        writeFileSync(tmp, body)
        renameSync(tmp, blobPath(space, hash))
        q.blobPut.run(space, hash, type, statSync(blobPath(space, hash)).size)
        return send(res, 201, { ok: true })
      }
    }

    if (path === '/api/piwigo' || path.startsWith('/api/piwigo/')) return handlePiwigo(req, res, url, path)

    return send(res, 404, { error: 'Unbekannte Adresse' })
  }

  /** Piwigo-Brücke: Alben, Fotos, Hochladen (nur wenn NWW_PIWIGO_* gesetzt). */
  async function handlePiwigo(req, res, url, path) {
    if (!piwigo) return send(res, 404, { error: 'Piwigo ist auf dem Server nicht eingerichtet.' })
    const sub = path.slice('/api/piwigo'.length)

    if (req.method === 'GET' && sub === '') return send(res, 200, { ok: true, ...(await piwigo.status()) })

    if (sub === '/albums') {
      if (req.method === 'GET') return send(res, 200, { albums: await piwigo.albums() })
      if (req.method === 'POST') {
        const body = JSON.parse((await readBody(req, 64 * 1024)).toString('utf8') || '{}')
        const parent = Number(body.parentId) || undefined
        return send(res, 201, await piwigo.createAlbum(body.name, parent))
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
        if (!data.length) return send(res, 400, { error: 'Keine Bilddaten.' })
        const type = String(req.headers['content-type'] ?? 'image/jpeg').slice(0, 100)
        if (!/^image\//.test(type)) return send(res, 400, { error: 'Nur Bilder.' })
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

    return send(res, 404, { error: 'Unbekannte Adresse' })
  }

  const server = createHttpServer((req, res) => {
    handle(req, res).catch((e) => {
      const status = e?.status ?? (e instanceof SyntaxError ? 400 : 500)
      if (status === 500) console.error(e)
      if (!res.headersSent) send(res, status, { error: status === 500 ? 'Serverfehler' : e.message })
      else res.end()
    })
  })
  server.on('close', () => db.close())
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
      : null
  })
  const port = Number(process.env.PORT ?? 8787)
  const host = process.env.NWW_HOST || undefined // z. B. 127.0.0.1, wenn nginx im selben Container läuft
  server.listen(port, host, () => console.log(`Nix wie weg – Abgleich-Server ${VERSION} läuft auf ${host ?? '*'}:${port}`))
  const stop = () => server.close(() => process.exit(0))
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
}
