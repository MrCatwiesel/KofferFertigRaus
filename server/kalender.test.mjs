import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyncServer } from './server.mjs'

const KEY = 'kalender-test-schluessel-1'
const OTHER = 'kalender-andere-gruppe-2'
let server, base, dir
const ICS = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:a@nix-wie-weg\r\nSUMMARY:Storno Hotel\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n'

const call = async (path, { method = 'GET', key = KEY, body } = {}) => {
  const r = await fetch(`${base}${path}`, { method, headers: key ? { Authorization: `Bearer ${key}` } : {}, body })
  const text = await r.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    /* Kalender */
  }
  return { status: r.status, json, text, type: r.headers.get('content-type') }
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'nww-kalender-'))
  server = createSyncServer({ keys: [KEY, OTHER], dataDir: dir })
  await new Promise((r) => server.listen(0, r))
  base = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  await new Promise((r) => server.close(r))
  rmSync(dir, { recursive: true, force: true })
})

test('Kalender-Abo: Adresse anlegen, Datei hochladen, öffentlich abrufen, erneuern, beenden', async () => {
  assert.deepEqual((await call('/api/kalender')).json, { token: null, updated: null })
  const { json } = await call('/api/kalender/link', { method: 'POST' })
  assert.match(json.token, /^[A-Za-z0-9_-]{32}$/)

  // vor dem ersten Hochladen: leerer Kalender statt Fehler
  const empty = await call(`/api/kalender/${json.token}.ics`, { key: null })
  assert.equal(empty.status, 200)
  assert.match(empty.text, /^BEGIN:VCALENDAR/)

  assert.equal((await call('/api/kalender', { method: 'PUT', body: 'kein Kalender' })).status, 400)
  const up = await call('/api/kalender', { method: 'PUT', body: ICS })
  assert.equal(up.status, 200)
  assert.ok(up.json.updated)

  const pub = await call(`/api/kalender/${json.token}.ics`, { key: null })
  assert.equal(pub.status, 200)
  assert.match(pub.type, /text\/calendar/)
  assert.equal(pub.text, ICS)

  // andere Gruppe sieht ihren eigenen (leeren) Stand
  assert.deepEqual((await call('/api/kalender', { key: OTHER })).json, { token: null, updated: null })
  // ohne Zugang kein Hochladen
  assert.equal((await call('/api/kalender', { method: 'PUT', body: ICS, key: 'falsch-falsch-falsch' })).status, 401)

  // erneuern: alte Adresse gilt nicht mehr, Datei bleibt
  const neu = (await call('/api/kalender/link', { method: 'POST' })).json
  assert.notEqual(neu.token, json.token)
  assert.equal((await call(`/api/kalender/${json.token}.ics`, { key: null })).status, 404)
  assert.equal((await call(`/api/kalender/${neu.token}.ics`, { key: null })).text, ICS)

  // beenden
  await call('/api/kalender/link', { method: 'DELETE' })
  assert.equal((await call(`/api/kalender/${neu.token}.ics`, { key: null })).status, 404)
  assert.deepEqual((await call('/api/kalender')).json, { token: null, updated: null })
  assert.notEqual((await call('/api/kalender/..%2F..%2Fetc%2Fpasswd.ics', { key: null })).status, 200)
})
