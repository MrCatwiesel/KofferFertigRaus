import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyncServer } from './server.mjs'

const KEY = 'routing-test-schluessel-1'
let server, base, dir
const calls = []

// Nachgebaute Kartendienste
async function fakeFetch(url, init = {}) {
  calls.push({ url: String(url), body: init.body ? String(init.body) : '', ua: init.headers?.['User-Agent'] })
  if (String(url).startsWith('https://overpass')) {
    const q = new URLSearchParams(String(init.body)).get('data')
    if (q.includes('voll')) return new Response('rate limited', { status: 429 })
    return new Response(JSON.stringify({ elements: [{ type: 'relation', id: 7, tags: { name: 'Testweg' } }], query: q }), { status: 200 })
  }
  if (String(url).startsWith('https://brouter')) {
    return new Response(JSON.stringify({ type: 'FeatureCollection', features: [{ properties: { 'track-length': '100' }, geometry: { coordinates: [[12, 47, 1], [12.001, 47.001, 2]] } }] }), { status: 200 })
  }
  throw new Error('unerwartet')
}

const call = async (path, key = KEY) => {
  const r = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${key}` } })
  return { status: r.status, body: await r.json().catch(() => null) }
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'nww-routing-'))
  server = createSyncServer({ keys: [KEY], dataDir: dir, routing: { overpassUrl: 'https://overpass.test/api', brouterUrl: 'https://brouter.test/brouter', fetchImpl: fakeFetch } })
  await new Promise((r) => server.listen(0, r))
  base = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  await new Promise((r) => server.close(r))
  rmSync(dir, { recursive: true, force: true })
})

test('Wanderwege: Abfrage wird auf dem Server gebaut, Name sicher, Zwischenspeicher', async () => {
  const r = await call('/api/routing/wanderwege?bbox=12.6,46.95,12.95,47.2&typ=hiking&name=Glockner%22%5D%3Bout')
  assert.equal(r.status, 200)
  assert.equal(r.body.elements[0].name ?? r.body.elements[0].tags.name, 'Testweg')
  assert.match(r.body.query, /\["route"~"\^\(hiking\|foot\)\$"\]\["name"~"Glockner\\\]\;out",i\]\(46\.95,12\.6,47\.2,12\.95\)/)
  assert.match(calls[0].ua, /^NixWieWeg\//)
  const n = calls.length
  await call('/api/routing/wanderwege?bbox=12.6,46.95,12.95,47.2&typ=hiking&name=Glockner%22%5D%3Bout')
  assert.equal(calls.length, n, 'zweite gleiche Suche aus dem Zwischenspeicher')
  assert.equal((await call('/api/routing/wanderwege?bbox=5,45,15,50&typ=hiking')).status, 400, 'zu großer Ausschnitt')
  assert.equal((await call('/api/routing/wanderwege?bbox=12.6,46.95,12.95,47.2&typ=boot')).status, 400)
  assert.equal((await call('/api/routing/wanderwege?bbox=12.6,46.95,12.95,47.2&typ=hiking&name=voll')).status, 503)
})

test('Geometrie einer Route und Routenplanung mit Prüfung der Eingaben', async () => {
  const g = await call('/api/routing/wanderwege/123456')
  assert.match(g.body.query, /relation\(123456\);\(\._;rel\(r\);\);out geom;/)
  const ok = await call('/api/routing/strecke?lonlats=12.7,47.1|12.8,47.2&profile=hiking-mountain')
  assert.equal(ok.status, 200)
  assert.equal(ok.body.features[0].properties['track-length'], '100')
  assert.match(calls.at(-1).url, /^https:\/\/brouter\.test\/brouter\?lonlats=12\.7%2C47\.1%7C12\.8%2C47\.2&profile=hiking-mountain/)
  assert.equal((await call('/api/routing/strecke?lonlats=12.7,47.1&profile=hiking-mountain')).status, 400, 'nur ein Punkt')
  assert.equal((await call('/api/routing/strecke?lonlats=12.7,47.1|12.8,47.2&profile=rakete')).status, 400)
  assert.equal((await call('/api/routing/strecke?lonlats=12.7,47.1|12.8,47.2&profile=car-fast', 'falscher-schluessel-xyz')).status, 401)
})
