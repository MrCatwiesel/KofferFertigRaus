import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyncServer } from './server.mjs'

// Abstimmungen: Jede Person ändert nur ihre eigene Stimme – auch mit „Nur lesen“.
const KEY = 'abstimmung-test-schluessel-1'
let server, base, dir
const s = {}

const call = async (method, path, token, body) => {
  const r = await fetch(`${base}${path}`, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, body: await r.json().catch(() => null) }
}
let n = 0
const stamp = () => `2026-10-14T11:${String(n++).padStart(2, '0')}:00.000Z`
const push = (tok, ...changes) => call('POST', '/api/push', tok, { changes: changes.map((c) => ({ stamp: stamp(), ...c })) })
const vote = (id, memberId, choices = ['o1']) => ({ tbl: 'pollVotes', id, data: { id, tripId: 'T1', pollId: 'p1', voter: id.split(':')[1], memberId, choices } })
const reasons = (r) => r.body.rejected.map((x) => x.reason)

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'nww-abst-'))
  server = createSyncServer({ keys: [KEY], dataDir: dir, push: { timer: false } })
  await new Promise((r) => server.listen(0, r))
  base = `http://127.0.0.1:${server.address().port}`
  s.marco = (await call('POST', '/api/anmelden', KEY, { name: 'iPad' })).body.token
  s.marcoId = (await call('POST', '/api/personen', s.marco, { name: 'Marco', self: true, password: 'marco-passwort' })).body.member.id
  for (const [name, role] of [['Lea', 'leser'], ['Kai', 'mitglied']]) {
    const inv = (await call('POST', '/api/personen', s.marco, { name, role })).body
    s[`${name}Id`] = inv.member.id
    s[name] = (await call('POST', '/api/anmelden', null, { invite: inv.invite.code, name: 'Handy', password: `${name}-passwort-1` })).body.token
  }
  await push(s.marco, { tbl: 'trips', id: 'T1', data: { id: 'T1', title: 'Rom', participants: ['Marco', 'Lea', 'Kai', 'Kind'] } }, { tbl: 'polls', id: 'p1', data: { id: 'p1', tripId: 'T1', question: 'Wohin am Samstag?' } })
})
after(async () => {
  await new Promise((r) => server.close(r))
  rmSync(dir, { recursive: true, force: true })
})

test('Leserin stimmt mit eigener Stimme ab, legt aber keine Abstimmung an', async () => {
  let r = await push(s.Lea, vote('p1:Lea', s.LeaId))
  assert.deepEqual(r.body.rejected, [])
  r = await push(s.Lea, vote('p1:Lea', s.LeaId, ['o2']))
  assert.deepEqual(r.body.rejected, [], 'eigene Stimme ändern')
  r = await push(s.Lea, { tbl: 'polls', id: 'p2', data: { id: 'p2', tripId: 'T1', question: 'Neu?' } })
  assert.deepEqual(reasons(r), ['nur-lesen'])
  r = await push(s.Lea, vote('p1:Kind', null))
  assert.deepEqual(reasons(r), ['nur-lesen'], 'für Kinder (ohne Konto) stimmt nur, wer bearbeiten darf')
})

test('Fremde Stimmen: nicht im Namen anderer, nicht überschreiben – löschen nur mit Bearbeiten-Recht', async () => {
  assert.deepEqual(reasons(await push(s.Lea, vote('p1:Marco', s.marcoId))), ['fremde-stimme'])
  assert.deepEqual(reasons(await push(s.Kai, vote('p1:Lea', s.KaiId))), ['fremde-stimme'], 'Kai überschreibt Leas Stimme')
  assert.deepEqual(reasons(await push(s.Kai, vote('p1:Lea', null))), ['fremde-stimme'])
  assert.deepEqual((await push(s.Kai, vote('p1:Kind', null))).body.rejected, [], 'Kai stimmt für das Kind')
  assert.deepEqual((await push(s.Kai, vote('p1:Kai', s.KaiId))).body.rejected, [])
  // Lea kann Kais Stimme nicht löschen, Kai (Bearbeiten) Leas schon (Abstimmung zurückgesetzt)
  assert.deepEqual(reasons(await push(s.Lea, { tbl: 'pollVotes', id: 'p1:Kai', deleted: true })), ['nur-lesen'])
  assert.deepEqual((await push(s.Lea, { tbl: 'pollVotes', id: 'p1:Lea', deleted: true })).body.rejected, [], 'eigene Stimme zurückziehen')
  await push(s.Lea, vote('p1:Lea', s.LeaId))
  assert.deepEqual((await push(s.Kai, { tbl: 'pollVotes', id: 'p1:Lea', deleted: true })).body.rejected, [])
  // Gruppenschlüssel (ohne Person): alles erlaubt
  assert.deepEqual((await push(KEY, vote('p1:Marco', s.marcoId))).body.rejected, [])
})

test('Kein Zugriff auf die Reise → keine Stimme', async () => {
  await call('PUT', '/api/zugriff/T1', s.marco, { member: s.LeaId, role: 'kein' })
  assert.deepEqual(reasons(await push(s.Lea, vote('p1:Lea', s.LeaId))), ['nur-lesen'])
})
