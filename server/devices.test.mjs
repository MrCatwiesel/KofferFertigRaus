import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyncServer } from './server.mjs'
import { agentLabel, clientIp, formatCode, isCode, normalizeCode } from './devices.mjs'

const KEY = 'geraete-test-schluessel-123'
const OTHER = 'andere-gruppe-schluessel-456'
let server
let base
let dir

const call = async (method, path, key, body, headers = {}) => {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}), 'Content-Type': 'application/json', ...headers },
    body: body ? JSON.stringify(body) : undefined
  })
  return { status: r.status, body: await r.json().catch(() => null) }
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'nww-dev-'))
  server = createSyncServer({ keys: [KEY, OTHER], dataDir: dir })
  await new Promise((r) => server.listen(0, r))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((r) => server.close(r))
  rmSync(dir, { recursive: true, force: true })
})

test('Hilfen: Codes, Adresse hinter dem Proxy, Gerätetyp', () => {
  assert.equal(formatCode('ABCDEFGHJKLM'), 'ABCD-EFGH-JKLM')
  assert.equal(normalizeCode(' abcd-efgh jklm '), 'ABCDEFGHJKLM')
  assert.ok(isCode('abcd-efgh-jklm'))
  assert.ok(!isCode('ABCD-EFGH-JKL0'), '0 gibt es im Alphabet nicht')
  // Proxy im Heimnetz → weitergereichte Adresse; direkte Verbindung von außen → Kopfzeile ignorieren
  assert.equal(clientIp({ socket: { remoteAddress: '192.168.5.33' }, headers: { 'x-forwarded-for': '93.1.2.3, 10.0.0.1' } }), '93.1.2.3')
  assert.equal(clientIp({ socket: { remoteAddress: '93.9.9.9' }, headers: { 'x-forwarded-for': '1.2.3.4' } }), '93.9.9.9')
  assert.equal(agentLabel('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'), 'iPad · Safari')
  assert.equal(agentLabel('Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36'), 'Android · Chrome')
})

test('Anmelden mit Gruppenschlüssel → eigener Gerätezugang, gleicher Datenbereich', async () => {
  const login = await call('POST', '/api/anmelden', KEY, { name: 'iPad Marco' })
  assert.equal(login.status, 201)
  assert.match(login.body.token, /^nwd_[A-Za-z0-9_-]{32}$/)
  assert.equal(login.body.device.name, 'iPad Marco')
  const tok = login.body.token

  await call('POST', '/api/push', KEY, { changes: [{ tbl: 'trips', id: 't1', stamp: '2026-01-01T00:00:00Z', data: { id: 't1', title: 'Test' } }] })
  const pulled = await call('GET', '/api/pull?since=0', tok)
  assert.equal(pulled.body.changes.length, 1, 'Gerät sieht die Daten der Gruppe')
  const info = await call('GET', '/api/info', tok)
  assert.equal(info.body.device.name, 'iPad Marco')
  assert.equal(info.body.devices, true)
  assert.equal((await call('POST', '/api/anmelden', tok, {})).status, 400, 'schon angemeldet')
  assert.equal((await call('POST', '/api/anmelden', 'falsch-falsch-falsch-1', {})).status, 401)
})

test('Einladung: einmal gültig, Gerät landet in der richtigen Gruppe', async () => {
  await call('POST', '/api/push', KEY, { changes: [{ tbl: 'trips', id: 't1', stamp: '2026-01-01T00:00:00Z', data: { id: 't1', title: 'Test' } }] })
  const marco = (await call('POST', '/api/anmelden', KEY, { name: 'iPad Marco' })).body.token
  const inv = await call('POST', '/api/einladungen', marco)
  assert.equal(inv.status, 201)
  assert.match(inv.body.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/)
  const birgit = await call('POST', '/api/anmelden', null, { invite: inv.body.code.toLowerCase().replace(/-/g, ' '), name: 'Android Birgit' })
  assert.equal(birgit.status, 201)
  assert.equal(birgit.body.group, 'Meine Reisen')
  assert.equal((await call('GET', '/api/pull?since=0', birgit.body.token)).body.changes.length, 1)
  const again = await call('POST', '/api/anmelden', null, { invite: inv.body.code })
  assert.equal(again.status, 400)
  assert.match(again.body.error, /schon benutzt/)
  assert.equal((await call('POST', '/api/anmelden', null, { invite: 'ABCD-EFGH-JKLM' })).status, 400)
})

test('Geräteliste, umbenennen, einzeln und „alle anderen“ abmelden – andere Gruppen bleiben getrennt', async () => {
  const a = (await call('POST', '/api/anmelden', KEY, { name: 'A' })).body
  const b = (await call('POST', '/api/anmelden', KEY, { name: 'B' })).body
  const c = (await call('POST', '/api/anmelden', KEY, { name: 'C' })).body
  const fremd = (await call('POST', '/api/anmelden', OTHER, { name: 'Fremd' })).body

  const list = (await call('GET', '/api/geraete', a.token)).body
  assert.ok(list.devices.some((d) => d.name === 'A' && d.current))
  assert.ok(list.keyLastSeen, 'früherer Abgleich mit Gruppenschlüssel wird angezeigt')
  assert.ok(!list.devices.some((d) => d.name === 'Fremd'), 'fremde Geräte unsichtbar')
  assert.equal((await call('DELETE', `/api/geraete/${fremd.device.id}`, a.token)).status, 404, 'fremdes Gerät nicht abmeldbar')

  assert.equal((await call('PATCH', `/api/geraete/${b.device.id}`, a.token, { name: 'B neu' })).body.name, 'B neu')
  assert.equal((await call('DELETE', `/api/geraete/${b.device.id}`, a.token)).status, 200)
  const gone = await call('GET', '/api/info', b.token)
  assert.equal(gone.status, 401)
  assert.equal(gone.body.code, 'abgemeldet')

  const r = await call('POST', '/api/geraete/andere-abmelden', a.token)
  assert.ok(r.body.revoked >= 1)
  assert.equal((await call('GET', '/api/info', c.token)).body.code, 'abgemeldet')
  assert.equal((await call('GET', '/api/info', a.token)).status, 200, 'eigenes Gerät bleibt')
  assert.equal((await call('GET', '/api/info', fremd.token)).status, 200, 'andere Gruppe unberührt')

  assert.equal((await call('DELETE', '/api/geraete/ich', a.token)).status, 200)
  assert.equal((await call('GET', '/api/info', a.token)).body.code, 'abgemeldet')
})

test('Neuer Gruppenschlüssel: alter gilt nicht mehr, Geräte bleiben angemeldet', async () => {
  const created = (await call('POST', '/api/admin/groups', KEY, { name: 'Freunde' })).body
  const dev = (await call('POST', '/api/anmelden', created.key, { name: 'Freund' })).body
  const rotated = await call('PATCH', `/api/admin/groups/${created.group.space}`, KEY, { newKey: true })
  assert.equal(rotated.status, 200)
  assert.notEqual(rotated.body.key, created.key)
  assert.equal((await call('GET', '/api/info', created.key)).status, 401)
  assert.equal((await call('GET', '/api/info', rotated.body.key)).status, 200)
  assert.equal((await call('GET', '/api/info', dev.token)).status, 200)
  // Gesperrte Gruppe: auch Geräte draußen
  await call('PATCH', `/api/admin/groups/${created.group.space}`, KEY, { disabled: true })
  assert.equal((await call('GET', '/api/info', dev.token)).body.code, 'gesperrt')
})

test('Viele Fehlversuche → kurze Sperre für diese Adresse', async () => {
  const ip = { 'X-Forwarded-For': '203.0.113.7' } // Test läuft über 127.0.0.1 → gilt als Proxy im eigenen Netz
  for (let i = 0; i < 20; i++) await call('GET', '/api/info', `nwd_${'x'.repeat(32)}`, null, ip)
  const locked = await call('GET', '/api/info', KEY, null, ip)
  assert.equal(locked.status, 429)
  assert.equal((await call('GET', '/api/info', KEY, null, { 'X-Forwarded-For': '203.0.113.8' })).status, 200, 'andere Adresse nicht betroffen')
})

test('Lange nicht benutzte Geräte werden abgemeldet', async () => {
  const d2 = mkdtempSync(join(tmpdir(), 'nww-idle-'))
  const s1 = createSyncServer({ keys: [KEY], dataDir: d2 })
  await new Promise((r) => s1.listen(0, r))
  const b1 = `http://127.0.0.1:${s1.address().port}`
  const tok = (await (await fetch(`${b1}/api/anmelden`, { method: 'POST', headers: { Authorization: `Bearer ${KEY}` }, body: '{}' })).json()).token
  await new Promise((r) => s1.close(r))
  await new Promise((r) => setTimeout(r, 50))
  // Neustart mit winziger Frist (≈ 9 ms): das Gerät war „zu lange“ weg
  const s2 = createSyncServer({ keys: [KEY], dataDir: d2, deviceIdleDays: 1e-7 })
  await new Promise((r) => s2.listen(0, r))
  try {
    const r = await fetch(`http://127.0.0.1:${s2.address().port}/api/info`, { headers: { Authorization: `Bearer ${tok}` } })
    assert.equal(r.status, 401)
    assert.equal((await r.json()).reason, 'lange nicht benutzt')
  } finally {
    await new Promise((r2) => s2.close(r2))
    rmSync(d2, { recursive: true, force: true })
  }
})

test('Abgleich-Stand je Gerät: fehlende und noch nicht hochgeladene Änderungen', async () => {
  const OWN = 'stand-test-schluessel-12345'
  const d3 = mkdtempSync(join(tmpdir(), 'nww-stand-'))
  const s = createSyncServer({ keys: [OWN], dataDir: d3 })
  await new Promise((r) => s.listen(0, r))
  const b3 = `http://127.0.0.1:${s.address().port}`
  const c3 = async (method, path, key, body, headers = {}) => {
    const r = await fetch(`${b3}${path}`, { method, headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined })
    return r.json()
  }
  try {
    const ipad = (await c3('POST', '/api/anmelden', OWN, { name: 'iPad' })).token
    const handy = (await c3('POST', '/api/anmelden', OWN, { name: 'Handy' })).token
    const change = (id) => ({ tbl: 'trips', id, stamp: '2026-01-01T00:00:00Z', data: { id } })
    await c3('POST', '/api/push', ipad, { changes: [change('a'), change('b'), change('c')] }, { 'X-NWW-Pending': '0' })
    await c3('GET', '/api/pull?since=0', ipad, null, { 'X-NWW-Pending': '0' })
    await c3('GET', '/api/pull?since=0&limit=2', handy, null, { 'X-NWW-Pending': '4' }) // nur erste Seite → Stand noch offen
    let list = (await c3('GET', '/api/geraete', ipad)).devices
    const by = (n) => list.find((d) => d.name === n)
    assert.equal(by('iPad').behind, 0)
    assert.equal(by('Handy').behind, null, 'noch nie vollständig geholt')
    assert.equal(by('Handy').pending, 4)
    await c3('GET', '/api/pull?since=2', handy, null, { 'X-NWW-Pending': '0' })
    await c3('POST', '/api/push', ipad, { changes: [change('d')] })
    list = (await c3('GET', '/api/geraete', ipad)).devices
    assert.equal(by('Handy').behind, 1, 'eine neue Änderung vom iPad fehlt dem Handy')
    assert.equal(by('Handy').pending, 0)
    assert.ok(by('Handy').synced)
  } finally {
    await new Promise((r) => s.close(r))
    rmSync(d3, { recursive: true, force: true })
  }
})
