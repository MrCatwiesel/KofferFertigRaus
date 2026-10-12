/**
 * Offline-Karten: Der Server schneidet einen Kartenausschnitt aus der frei verfügbaren Protomaps-Weltkarte
 * (OpenStreetMap-Daten, Vektor-Kacheln im PMTiles-Format) aus. Die App lädt die fertige Datei einmal herunter
 * und zeigt die Karte danach ganz ohne Internet.
 *
 * Warum nicht einfach OSM-Kacheln speichern? Die Nutzungsregeln von tile.openstreetmap.org verbieten
 * das Vorab-Laden für die Offline-Nutzung ausdrücklich. Protomaps-Auszüge sind genau dafür gedacht.
 *
 * Werkzeug: das Programm „pmtiles“ (go-pmtiles, wird von update.sh installiert).
 * Ablage: <daten>/maps/<gruppe>/<id>.pmtiles und <id>.json – jede Reisegruppe sieht nur ihre Karten.
 */
import { spawn, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { createReadStream, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { HttpError, readJson, send } from './http.mjs'

const ID_RE = /^[a-f0-9]{16}$/
const MAX_SPAN = 3 // Grad – etwa 330 × 230 km in Mitteleuropa
const MAX_PER_GROUP = 12
const JOB_TIMEOUT = 45 * 60_000
const BUILD_URL = (day) => `https://build.protomaps.com/${day}.pmtiles`

/** Ausschnitt prüfen: [West, Süd, Ost, Nord] in Grad. */
export function cleanBbox(b) {
  if (!Array.isArray(b) || b.length !== 4) throw new HttpError(400, 'Ausschnitt fehlt.')
  const [w, s, e, n] = b.map(Number)
  if (![w, s, e, n].every(Number.isFinite)) throw new HttpError(400, 'Ausschnitt ungültig.')
  if (w < -180 || e > 180 || s < -85 || n > 85 || w >= e || s >= n) throw new HttpError(400, 'Ausschnitt ungültig.')
  if (e - w > MAX_SPAN || n - s > MAX_SPAN) throw new HttpError(400, `Ausschnitt zu groß (höchstens ${MAX_SPAN}° × ${MAX_SPAN}°) – bitte näher heranzoomen.`)
  return [w, s, e, n].map((v) => Math.round(v * 1e5) / 1e5)
}

export function createMaps(dataDir, opts = {}) {
  const bin = opts.bin || 'pmtiles'
  const root = join(dataDir, 'maps')
  const fetchImpl = opts.fetchImpl ?? fetch
  let available = null
  let running = null // { id, space, child }
  let sourceCache = null // { url, at }

  const dirOf = (space) => join(root, space)
  const metaPath = (space, id) => join(dirOf(space), `${id}.json`)
  const filePath = (space, id) => join(dirOf(space), `${id}.pmtiles`)

  function isAvailable() {
    if (available === null) {
      const r = spawnSync(bin, ['version'], { encoding: 'utf8', timeout: 5000 })
      available = r.status === 0
    }
    return available
  }

  function readMeta(space, id) {
    try {
      return JSON.parse(readFileSync(metaPath(space, id), 'utf8'))
    } catch {
      return null
    }
  }
  const writeMeta = (space, meta) => writeFileSync(metaPath(space, meta.id), JSON.stringify(meta))

  function list(space) {
    if (!existsSync(dirOf(space))) return []
    return readdirSync(dirOf(space))
      .filter((f) => f.endsWith('.json'))
      .map((f) => readMeta(space, f.slice(0, -5)))
      .filter(Boolean)
      .sort((a, b) => b.created.localeCompare(a.created))
  }

  /** Neueste Weltkarte von Protomaps finden (täglich neu, ältere werden nach einiger Zeit gelöscht). */
  async function source() {
    if (opts.source) return opts.source
    if (sourceCache && Date.now() - sourceCache.at < 6 * 3600_000) return sourceCache.url
    for (let back = 0; back < 21; back++) {
      const day = new Date(Date.now() - back * 86400_000).toISOString().slice(0, 10).replace(/-/g, '')
      try {
        const r = await fetchImpl(BUILD_URL(day), { method: 'HEAD' })
        if (r.ok) {
          sourceCache = { url: BUILD_URL(day), at: Date.now() }
          return sourceCache.url
        }
      } catch {
        /* nächster Tag */
      }
    }
    throw new Error('Keine aktuelle Weltkarte bei Protomaps gefunden – später erneut versuchen.')
  }

  async function start(space, meta) {
    const out = filePath(space, meta.id)
    const tmp = `${out}.tmp`
    let src
    try {
      src = await source()
    } catch (e) {
      writeMeta(space, { ...meta, status: 'fehler', error: e.message })
      running = null
      return
    }
    const args = ['extract', src, tmp, `--bbox=${meta.bbox.join(',')}`, `--maxzoom=${meta.maxzoom}`, '--download-threads=4']
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    running = { id: meta.id, space, child }
    let log = ''
    const keep = (d) => (log = (log + d.toString()).slice(-2000))
    child.stdout.on('data', keep)
    child.stderr.on('data', keep)
    const timer = setTimeout(() => child.kill('SIGTERM'), JOB_TIMEOUT)
    child.on('close', (code) => {
      clearTimeout(timer)
      running = null
      const current = readMeta(space, meta.id)
      if (!current) {
        rmSync(tmp, { force: true }) // inzwischen gelöscht
        return
      }
      if (code === 0 && existsSync(tmp) && statSync(tmp).size > 0) {
        renameSync(tmp, out)
        writeMeta(space, { ...current, status: 'fertig', size: statSync(out).size, source: src, finished: new Date().toISOString() })
      } else {
        rmSync(tmp, { force: true })
        const last = log.trim().split('\n').slice(-2).join(' ').slice(0, 300)
        writeMeta(space, { ...current, status: 'fehler', error: `Ausschneiden fehlgeschlagen (${code ?? 'abgebrochen'}): ${last}` })
      }
    })
    child.on('error', (e) => {
      clearTimeout(timer)
      running = null
      writeMeta(space, { ...meta, status: 'fehler', error: e.message })
    })
  }

  /** Datei mit Unterstützung für Teilbereiche (Range) ausliefern. */
  function serveFile(req, res, path, name) {
    const size = statSync(path).size
    const headers = {
      'Content-Type': 'application/vnd.pmtiles',
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'private, max-age=31536000, immutable',
      'Content-Disposition': `attachment; filename="${name}"`
    }
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range ?? ''))
    if (m && (m[1] || m[2])) {
      let start = m[1] ? Number(m[1]) : size - Number(m[2])
      let end = m[1] && m[2] ? Number(m[2]) : size - 1
      start = Math.max(0, start)
      end = Math.min(size - 1, end)
      if (start > end) {
        res.writeHead(416, { 'Content-Range': `bytes */${size}` })
        return res.end()
      }
      res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) })
      if (req.method === 'HEAD') return res.end()
      return createReadStream(path, { start, end }).pipe(res)
    }
    res.writeHead(200, { ...headers, 'Content-Length': String(size) })
    if (req.method === 'HEAD') return res.end()
    return createReadStream(path).pipe(res)
  }

  return {
    get available() {
      return isAvailable()
    },

    removeSpace(space) {
      if (running?.space === space) running.child.kill('SIGTERM')
      rmSync(dirOf(space), { recursive: true, force: true })
    },

    async handle(req, res, path, group) {
      const { space } = group
      const sub = path.slice('/api/maps'.length)

      if (sub === '' && req.method === 'GET') return send(res, 200, { available: isAvailable(), maps: list(space) })

      if (sub === '' && req.method === 'POST') {
        if (!isAvailable()) throw new HttpError(501, 'Offline-Karten sind auf dem Server noch nicht eingerichtet – bitte update.sh ausführen.')
        const body = await readJson(req)
        const bbox = cleanBbox(body.bbox)
        const maxzoom = [12, 13, 14, 15].includes(Number(body.maxzoom)) ? Number(body.maxzoom) : 14
        const name = String(body.name ?? '').trim().slice(0, 80) || 'Karte'
        if (list(space).length >= MAX_PER_GROUP) throw new HttpError(400, `Höchstens ${MAX_PER_GROUP} Karten – bitte alte löschen.`)
        if (running) throw new HttpError(409, 'Es wird gerade schon eine Karte erstellt – bitte kurz warten.')
        mkdirSync(dirOf(space), { recursive: true })
        const tripId = /^[A-Za-z0-9_-]{1,64}$/.test(body.tripId ?? '') ? body.tripId : ''
        const meta = { id: randomBytes(8).toString('hex'), name, tripId, bbox, maxzoom, status: 'läuft', size: 0, error: '', created: new Date().toISOString() }
        writeMeta(space, meta)
        running = { id: meta.id, space, child: null }
        void start(space, meta)
        return send(res, 202, meta)
      }

      const m = sub.match(/^\/([a-f0-9]{16})(\/datei)?$/)
      if (!m || !ID_RE.test(m[1])) throw new HttpError(404, 'Unbekannte Adresse')
      const meta = readMeta(space, m[1])
      if (!meta) throw new HttpError(404, 'Karte nicht gefunden.')

      if (m[2]) {
        if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'Nicht erlaubt')
        if (meta.status !== 'fertig') throw new HttpError(409, 'Die Karte ist noch nicht fertig.')
        return serveFile(req, res, filePath(space, meta.id), `${meta.id}.pmtiles`)
      }
      if (req.method === 'GET') return send(res, 200, meta)
      if (req.method === 'DELETE') {
        if (running?.id === meta.id) running.child?.kill('SIGTERM')
        rmSync(metaPath(space, meta.id), { force: true })
        rmSync(filePath(space, meta.id), { force: true })
        rmSync(`${filePath(space, meta.id)}.tmp`, { force: true })
        return send(res, 200, { ok: true })
      }
      throw new HttpError(405, 'Nicht erlaubt')
    }
  }
}
