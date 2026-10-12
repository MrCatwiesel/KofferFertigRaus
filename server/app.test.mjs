import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyncServer } from './server.mjs'

const KEY = 'familie-test-schluessel-123'
let server
let base
let dir
let app

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'nww-app-'))
  app = join(dir, 'app')
  mkdirSync(join(app, 'assets'), { recursive: true })
  writeFileSync(join(app, 'index.html'), '<!doctype html><title>Nix wie weg</title>')
  writeFileSync(join(app, 'sw.js'), 'self.x=1')
  writeFileSync(join(app, 'manifest.webmanifest'), '{}')
  writeFileSync(join(app, 'assets', 'index-abc123.js'), 'console.log(1)')
  writeFileSync(join(dir, 'geheim.txt'), 'nicht ausliefern')
  server = createSyncServer({ keys: [KEY], dataDir: join(dir, 'data'), appDir: app })
  await new Promise((r) => server.listen(0, r))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((r) => server.close(r))
  rmSync(dir, { recursive: true, force: true })
})

test('App: Startseite ohne Schlüssel, nicht im Cache festhalten', async () => {
  const r = await fetch(`${base}/`)
  assert.equal(r.status, 200)
  assert.match(r.headers.get('content-type') ?? '', /text\/html/)
  assert.equal(r.headers.get('cache-control'), 'no-cache')
  assert.match(await r.text(), /Nix wie weg/)
})

test('App: Dateien mit Prüfsummen-Namen lange im Cache', async () => {
  const r = await fetch(`${base}/assets/index-abc123.js`)
  assert.equal(r.status, 200)
  assert.match(r.headers.get('content-type') ?? '', /javascript/)
  assert.match(r.headers.get('cache-control') ?? '', /immutable/)
})

test('App: Service Worker und Manifest immer frisch', async () => {
  const sw = await fetch(`${base}/sw.js`)
  assert.equal(sw.headers.get('cache-control'), 'no-cache')
  const m = await fetch(`${base}/manifest.webmanifest`)
  assert.equal(m.headers.get('content-type'), 'application/manifest+json')
})

test('App: fehlende Datei 404, unbekannte Seite → Startseite', async () => {
  assert.equal((await fetch(`${base}/gibts-nicht.js`)).status, 404)
  const r = await fetch(`${base}/irgendwo`)
  assert.equal(r.status, 200)
  assert.match(await r.text(), /Nix wie weg/)
})

test('App: kein Zugriff außerhalb des App-Ordners', async () => {
  const r = await fetch(`${base}/%2e%2e/geheim.txt`)
  assert.notEqual(r.status, 200)
  const r2 = await fetch(`${base}/..%2fgeheim.txt`)
  assert.notEqual(r2.status, 200)
})

test('App: Schnittstelle bleibt geschützt und erreichbar', async () => {
  const h = await (await fetch(`${base}/api/health`)).json()
  assert.equal(h.ok, true)
  assert.equal(h.appHosted, true)
  assert.equal((await fetch(`${base}/api/info`)).status, 401)
  assert.equal((await fetch(`${base}/api/info`, { headers: { Authorization: `Bearer ${KEY}` } })).status, 200)
})
