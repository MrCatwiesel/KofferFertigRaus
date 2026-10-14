import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyncServer } from './server.mjs'

const KEY = 'abstimmung-test-schluessel-12'
let server
let base
let dir

const call = async (method, path, token, body) => {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  return { status: r.status, body: await r.json().catch(() => null) }
}
let n = 0
const stamp = () => `2026-10-14T11:${String(n++).padStart(2, '0')}:00.000Z`
const push = (tok, tbl, id, data) => call('POST', '/api/push', tok, { changes: [{ tbl, id, stamp: stamp(), deleted: false, data }] })
const vote = (voter, choices = ['o1']) => ({ id: `p1:${voter}`, pollId: 'p1', tripId: 't1', voter, choices })

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'nww-abst-'))
  server = createSyncServer({ keys: [KEY], dataDir: dir, push: { timer: false } })
  await new Promise((r) => server.listen(0, r))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((r) => server.close(r))
  rmSync(dir, { recursive: true, force: true })
})

test('Stimmen: eigene auch mit „nur lesen“, fremde verknüpfte nie, unverknüpfte nur mit Bearbeiten', async () => {
  const marco = (await call('POST', '/api/anmelden', KEY, { name: 'iPad Marco' })).body.token
  const me = await call('POST', '/api/personen', marco, { name: 'Marco', self: true, password: 'marco-passwort' })
  const inv = await call('POST', '/api/personen', marco, { name: 'Birgit', role: 'leser' })
  const birgit = (await call('POST', '/api/anmelden', null, { invite: inv.body.invite.code, name: 'Handy', password: 'birgit-passwort' })).body.token
  const links = { Marco: me.body.member.id, Birgit: inv.body.member.id }
  assert.equal((await push(marco, 'trips', 't1', { id: 't1', title: 'Dolomiten', participants: ['Marco', 'Birgit', 'Oma'], memberLinks: links })).body.rejected.length, 0)
  assert.equal((await push(marco, 'polls', 'p1', { id: 'p1', tripId: 't1', question: 'Wohin am Sonntag?' })).body.rejected.length, 0)

  // Birgit liest nur – ihre eigene Stimme geht trotzdem
  assert.equal((await push(birgit, 'pollVotes', 'p1:Birgit', vote('Birgit'))).body.rejected.length, 0)
  assert.equal((await push(birgit, 'pollVotes', 'p1:Oma', vote('Oma'))).body.rejected[0].reason, 'nur-lesen')
  assert.equal((await push(birgit, 'polls', 'p2', { id: 'p2', tripId: 't1', question: 'x' })).body.rejected[0].reason, 'nur-lesen')
  // Marco stimmt nicht für Birgit ab, aber für die Oma (ohne Konto)
  assert.equal((await push(marco, 'pollVotes', 'p1:Birgit', vote('Birgit', ['o2']))).body.rejected[0].reason, 'privat')
  assert.equal((await push(marco, 'pollVotes', 'p1:Oma', vote('Oma'))).body.rejected.length, 0)
  // Umbenennen der Stimme auf jemand anderen geht nicht
  assert.equal((await push(birgit, 'pollVotes', 'p1:Birgit', vote('Marco'))).body.rejected[0].reason, 'privat')

  // Kein Zugriff mehr auf die Reise → auch keine Stimme
  await call('PUT', '/api/zugriff/t1', marco, { member: links.Birgit, role: 'kein' })
  assert.equal((await push(birgit, 'pollVotes', 'p1:Birgit', vote('Birgit', ['o3']))).body.rejected.length, 1)
})
