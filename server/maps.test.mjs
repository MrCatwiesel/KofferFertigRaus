import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { createSyncServer } from './server.mjs'
import { cleanBbox, createMaps } from './maps.mjs'

const KEY = 'karten-test-schluessel-123'
const OTHER = 'andere-gruppe-schluessel-456'
let server
let base
let dir

// Ersatz für das Programm „pmtiles“: schreibt seine Argumente in die Ausgabedatei, scheitert bei Breite 13.5
const FAKE = `#!/bin/sh
if [ "$1" = "version" ]; then echo "pmtiles fake"; exit 0; fi
case "$*" in *13.5*) echo "kaputt" >&2; exit 3;; esac
sleep 0.2
echo "PMTILES $*" > "$3"
`

const call = async (method, path, key, body, headers = {}) => {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}), 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await r.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* Datei */
  }
  return { status: r.status, body: json, text, headers: r.headers }
}

const waitFor = async (id, key = KEY) => {
  for (let i = 0; i < 50; i++) {
    const m = (await call('GET', `/api/maps/${id}`, key)).body
    if (m.status !== 'läuft') return m
    await new Promise((r) => setTimeout(r, 100))
  }
  throw new Error('Karte wird nicht fertig')
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'nww-maps-'))
  const bin = join(dir, 'pmtiles')
  writeFileSync(bin, FAKE)
  chmodSync(bin, 0o755)
  server = createSyncServer({ keys: [KEY, OTHER], dataDir: join(dir, 'data'), maps: { bin, source: 'https://example.test/welt.pmtiles' } })
  await new Promise((r) => server.listen(0, r))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((r) => server.close(r))
  rmSync(dir, { recursive: true, force: true })
})

test('Ausschnitt wird geprüft', () => {
  assert.deepEqual(cleanBbox([12.6, 46.95, 12.95, 47.2]), [12.6, 46.95, 12.95, 47.2])
  assert.throws(() => cleanBbox([12, 47, 11, 48]), /ungültig/)
  assert.throws(() => cleanBbox([5, 45, 15, 50]), /zu groß/)
  assert.throws(() => cleanBbox('x'), /fehlt/)
})

test('Karte erstellen, Status abfragen, herunterladen (auch in Teilen), löschen', async () => {
  const info = await call('GET', '/api/info', KEY)
  assert.equal(info.body.maps, true)
  const c = await call('POST', '/api/maps', KEY, { name: 'Großglockner', bbox: [12.6, 46.95, 12.95, 47.2], maxzoom: 15 })
  assert.equal(c.status, 202)
  assert.equal(c.body.status, 'läuft')
  assert.equal((await call('POST', '/api/maps', KEY, { bbox: [1, 1, 2, 2] })).status, 409, 'nur eine gleichzeitig')
  const done = await waitFor(c.body.id)
  assert.equal(done.status, 'fertig')
  assert.ok(done.size > 0)

  const file = await call('GET', `/api/maps/${c.body.id}/datei`, KEY)
  assert.equal(file.status, 200)
  assert.match(file.text, /^PMTILES extract https:\/\/example.test\/welt.pmtiles .* --bbox=12.6,46.95,12.95,47.2 --maxzoom=15/)
  const part = await call('GET', `/api/maps/${c.body.id}/datei`, KEY, null, { Range: 'bytes=0-6' })
  assert.equal(part.status, 206)
  assert.equal(part.text, 'PMTILES')
  assert.equal(part.headers.get('content-range'), `bytes 0-6/${done.size}`)

  // Andere Gruppe sieht und bekommt nichts
  assert.deepEqual((await call('GET', '/api/maps', OTHER)).body.maps, [])
  assert.equal((await call('GET', `/api/maps/${c.body.id}/datei`, OTHER)).status, 404)
  assert.equal((await call('GET', '/api/maps', null)).status, 401)

  assert.equal((await call('GET', '/api/maps', KEY)).body.maps.length, 1)
  assert.equal((await call('DELETE', `/api/maps/${c.body.id}`, KEY)).status, 200)
  assert.equal((await call('GET', '/api/maps', KEY)).body.maps.length, 0)
})

test('Fehler beim Ausschneiden wird gemeldet', async () => {
  const c = await call('POST', '/api/maps', KEY, { bbox: [13.5, 47, 13.9, 47.3] })
  const done = await waitFor(c.body.id)
  assert.equal(done.status, 'fehler')
  assert.match(done.error, /kaputt/)
  assert.equal((await call('GET', `/api/maps/${c.body.id}/datei`, KEY)).status, 409)
})

test('Ohne Programm pmtiles: sauber „nicht eingerichtet“', async () => {
  const maps = createMaps(join(dir, 'leer'), { bin: join(dir, 'gibt-es-nicht') })
  assert.equal(maps.available, false)
})

test('Neueste Weltkarte wird gesucht (heute nicht da, gestern schon)', async () => {
  const asked = []
  const fetchImpl = async (url) => {
    asked.push(url)
    return { ok: asked.length === 2 }
  }
  const maps = createMaps(join(dir, 'quelle'), { bin: join(dir, 'pmtiles'), fetchImpl })
  let sent
  const fakeRes = { writeHead: (s) => (sent = s), end: () => {} }
  const req = Object.assign(Readable.from([Buffer.from(JSON.stringify({ bbox: [12.6, 46.95, 12.95, 47.2] }))]), { method: 'POST', headers: {} })
  await maps.handle(req, fakeRes, '/api/maps', { space: 'abc' })
  assert.equal(sent, 202)
  await new Promise((r) => setTimeout(r, 600))
  const [m] = await new Promise((resolve) => {
    maps.handle({ method: 'GET', headers: {} }, { writeHead() {}, end: (b) => resolve(JSON.parse(b).maps) }, '/api/maps', { space: 'abc' })
  })
  assert.equal(m.status, 'fertig')
  assert.match(m.source, /^https:\/\/build\.protomaps\.com\/\d{8}\.pmtiles$/)
  assert.equal(asked.length, 2)
})
