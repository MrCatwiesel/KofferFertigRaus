import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyncServer } from './server.mjs'

const OWNER = 'besitzer-schluessel-0001'
const SECOND = 'zweite-gruppe-schluessel-02'
let server
let base
let dir
let fakePiwigo

const h = (key, extra = {}) => ({ Authorization: `Bearer ${key}`, ...extra })
const json = (key) => h(key, { 'Content-Type': 'application/json' })
const call = async (method, path, key, body) => {
  const r = await fetch(`${base}${path}`, { method, headers: body ? json(key) : h(key), body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, body: await r.json().catch(() => null) }
}
const push = (key, changes) => call('POST', '/api/push', key, { changes })

before(async () => {
  // Piwigo-Ersatz: beantwortet nur die Anmeldung (für die Freigabe-Prüfung reicht das)
  fakePiwigo = createServer((req, res) => {
    res.setHeader('Set-Cookie', ['pwg_id=x'])
    res.end(JSON.stringify({ stat: 'ok', result: { username: 'denet', status: 'webmaster', pwg_token: 't' } }))
  })
  await new Promise((r) => fakePiwigo.listen(0, r))
  dir = mkdtempSync(join(tmpdir(), 'nww-grp-'))
  server = createSyncServer({
    keys: [OWNER, SECOND],
    dataDir: dir,
    piwigo: { url: `http://127.0.0.1:${fakePiwigo.address().port}`, keyId: 'pkid-20261011-abcdefghij0123456789', secret: 'a'.repeat(40) }
  })
  await new Promise((r) => server.listen(0, r))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((r) => server.close(r))
  await new Promise((r) => fakePiwigo.close(r))
  rmSync(dir, { recursive: true, force: true })
})

test('Besitzer = erster Schlüssel, nur er verwaltet Gruppen', async () => {
  const me = await call('GET', '/api/info', OWNER)
  assert.equal(me.body.admin, true)
  assert.equal(me.body.piwigo, true)
  const other = await call('GET', '/api/info', SECOND)
  assert.equal(other.body.admin, false)
  assert.equal(other.body.piwigo, false, 'Piwigo standardmäßig nur für den Besitzer')
  assert.equal((await call('GET', '/api/admin/groups', SECOND)).status, 403)
  assert.equal((await call('GET', '/api/piwigo', SECOND)).status, 403)
})

test('Gruppe anlegen: eigener Schlüssel, getrennte Daten', async () => {
  const created = await call('POST', '/api/admin/groups', OWNER, { name: 'Familie Müller' })
  assert.equal(created.status, 201)
  const key = created.body.key
  assert.match(key, /^[a-f0-9]{32}$/)
  await push(OWNER, [{ tbl: 'trips', id: 'geheim', stamp: '2026-01-01T00:00:00Z', data: { id: 'geheim', title: 'Meine Reise' } }])
  await push(key, [{ tbl: 'trips', id: 'm1', stamp: '2026-01-01T00:00:00Z', data: { id: 'm1', title: 'Müllers Reise' } }])
  const theirs = await call('GET', '/api/pull?since=0', key)
  assert.deepEqual(theirs.body.changes.map((c) => c.id), ['m1'])
  const list = await call('GET', '/api/admin/groups', OWNER)
  const g = list.body.groups.find((x) => x.name === 'Familie Müller')
  assert.equal(g.records, 1)
  assert.equal(g.source, 'app')
  assert.ok(!('key' in g) && !('key_hash' in g), 'Liste enthält keine Schlüssel')
})

test('Piwigo freigeben, Gruppe sperren und löschen', async () => {
  const { body } = await call('POST', '/api/admin/groups', OWNER, { name: 'Freunde' })
  const space = body.group.space
  assert.equal((await call('GET', '/api/piwigo', body.key)).status, 403)
  await call('PATCH', `/api/admin/groups/${space}`, OWNER, { piwigo: true })
  assert.equal((await call('GET', '/api/info', body.key)).body.piwigo, true)

  await call('PATCH', `/api/admin/groups/${space}`, OWNER, { disabled: true })
  assert.equal((await call('GET', '/api/info', body.key)).status, 401)
  await call('PATCH', `/api/admin/groups/${space}`, OWNER, { disabled: false })
  assert.equal((await call('GET', '/api/info', body.key)).status, 200)

  await push(body.key, [{ tbl: 'trips', id: 'f1', stamp: '2026-01-01T00:00:00Z', data: { id: 'f1' } }])
  assert.equal((await call('DELETE', `/api/admin/groups/${space}`, OWNER)).status, 200)
  assert.equal((await call('GET', '/api/info', body.key)).status, 401)
})

test('eigene und fest eingetragene Gruppen sind geschützt', async () => {
  const list = (await call('GET', '/api/admin/groups', OWNER)).body.groups
  const own = list.find((g) => g.owner)
  const second = list.find((g) => !g.owner && g.source === 'env')
  assert.equal((await call('PATCH', `/api/admin/groups/${own.space}`, OWNER, { disabled: true })).status, 400)
  assert.equal((await call('DELETE', `/api/admin/groups/${own.space}`, OWNER)).status, 400)
  assert.equal((await call('DELETE', `/api/admin/groups/${second.space}`, OWNER)).status, 400)
  assert.equal((await call('POST', '/api/admin/groups', OWNER, { name: '  ' })).status, 400)
})
