import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyncServer } from './server.mjs'

const KEY = 'reiseinfo-test-schluessel-1'
const fixture = (n) => readFileSync(new URL(`../e2e/fixtures/${n}`, import.meta.url), 'utf8')
let server, base, dir
const calls = []
let down = false

async function fakeFetch(url, init = {}) {
  calls.push({ url: String(url), ua: init.headers?.['User-Agent'] })
  if (down) throw new Error('offline')
  if (String(url) === 'https://aa.test/representativesInCountry') return new Response(fixture('aa-vertretungen.json'), { status: 200 })
  if (String(url) === 'https://aa.test/travelwarning') return new Response(fixture('aa-liste.json'), { status: 200 })
  if (String(url) === 'https://aa.test/travelwarning/210962') return new Response(fixture('aa-oesterreich.json'), { status: 200 })
  return new Response('nicht da', { status: 404 })
}

const call = async (path, key = KEY) => {
  const r = await fetch(`${base}${path}`, { headers: { Authorization: `Bearer ${key}` } })
  return { status: r.status, body: await r.json().catch(() => null) }
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'nww-reiseinfo-'))
  server = createSyncServer({ keys: [KEY], dataDir: dir, reiseinfo: { url: 'https://aa.test/', fetchImpl: fakeFetch } })
  await new Promise((r) => server.listen(0, r))
  base = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  await new Promise((r) => server.close(r))
  rmSync(dir, { recursive: true, force: true })
})

test('Reisehinweise: Land über die Liste finden, Einzelseite liefern, zwischenspeichern', async () => {
  const r = await call('/api/reiseinfo/AT')
  assert.equal(r.status, 200)
  assert.equal(r.body.response['210962'].countryName, 'Österreich')
  assert.match(r.body.response['210962'].content, /Impfschutz/)
  assert.ok(calls.every((c) => c.ua.startsWith('NixWieWeg/')))
  const n = calls.length
  await call('/api/reiseinfo/AT')
  assert.equal(calls.length, n, 'zweiter Abruf aus dem Zwischenspeicher')
})

test('Reisehinweise: unbekanntes Land, falsche Codes, ohne Zugang', async () => {
  assert.equal((await call('/api/reiseinfo/ZZ')).status, 404)
  assert.equal((await call('/api/reiseinfo/at')).status, 404, 'nur Großbuchstaben')
  assert.equal((await call('/api/reiseinfo/AUT')).status, 404)
  assert.equal((await call('/api/reiseinfo/AT', 'falscher-schluessel-xyz')).status, 401)
})

test('Reisehinweise: Thailand liegt in der Liste, Einzelseite fehlt → Fehler, nicht Absturz', async () => {
  const r = await call('/api/reiseinfo/TH')
  assert.equal(r.status, 502)
  down = true
  assert.equal((await call('/api/reiseinfo/AT')).status, 200, 'zwischengespeichert, auch wenn das Amt nicht erreichbar ist')
  down = false
})

test('Auslandsvertretungen: nach Ländernamen aus den Reisehinweisen gefunden', async () => {
  const r = await call('/api/reiseinfo/AT/vertretungen')
  assert.equal(r.status, 200)
  assert.equal(r.body.countryName, 'Österreich')
  assert.equal(r.body.missions.contentList.length, 3)
  assert.equal(r.body.missions['300001'].city, 'Wien')
  const th = await call('/api/reiseinfo/TH/vertretungen')
  assert.equal(th.status, 200)
  assert.equal(th.body.missions, null, 'Land ohne Eintrag → leer, kein Fehler')
  assert.equal((await call('/api/reiseinfo/ZZ/vertretungen')).status, 404)
  assert.equal((await call('/api/reiseinfo/AT/vertretungen/x')).status, 404)
})
