import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyncServer } from './server.mjs'

const KEY = 'familie-test-schluessel-123'
const OTHER = 'andere-gruppe-schluessel-456'
let server
let base
let dir

const h = (key) => ({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' })
const call = async (method, path, key, body, extra = {}) => {
  const r = await fetch(`${base}${path}`, { method, headers: { ...(key ? h(key) : {}), ...extra }, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, body: await r.json().catch(() => null), res: r }
}
const sha = (b) => createHash('sha256').update(b).digest('hex')
const stamp = '2026-07-10T10:00:00Z'

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'nww-share-'))
  server = createSyncServer({ keys: [KEY, OTHER], dataDir: dir })
  await new Promise((r) => server.listen(0, r))
  base = `http://127.0.0.1:${server.address().port}`

  // Fotos hochladen
  for (const b of ['voll-1', 'klein-1', 'voll-2', 'klein-2']) {
    await fetch(`${base}/api/blob/${sha(b)}`, { method: 'PUT', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'image/jpeg' }, body: b })
  }
  const ref = (b) => ({ __blobRef: sha(b), type: 'image/jpeg' })
  const changes = [
    { tbl: 'trips', id: 't1', data: { id: 't1', title: 'Gardasee', destination: 'Riva', startDate: '2026-07-01', endDate: '2026-07-07', budget: 47113, participants: ['Marco', 'Birgit'], notes: 'privat' } },
    { tbl: 'journalEntries', id: 'e1', data: { id: 'e1', tripId: 't1', date: '2026-07-02', title: 'Seeblick', text: 'Toll', mood: 5, location: 'Riva', highlight: true, photoIds: ['p1'], createdAt: stamp } },
    { tbl: 'journalEntries', id: 'e2', data: { id: 'e2', tripId: 't1', date: '2026-07-03', title: 'Regentag', text: 'Museum', mood: 3, location: '', highlight: false, photoIds: ['p2'], createdAt: stamp } },
    { tbl: 'photos', id: 'p1', data: { id: 'p1', tripId: 't1', entryId: 'e1', full: ref('voll-1'), thumb: ref('klein-1'), width: 2048, height: 1536, caption: 'See' } },
    { tbl: 'photos', id: 'p2', data: { id: 'p2', tripId: 't1', entryId: 'e2', full: ref('voll-2'), thumb: ref('klein-2'), width: 1536, height: 2048, caption: 'Museum' } },
    { tbl: 'expenses', id: 'x1', data: { id: 'x1', tripId: 't1', amount: 99, title: 'Pizza' } },
    { tbl: 'medications', id: 'm1', data: { id: 'm1', tripId: 't1', name: 'Geheim' } },
    { tbl: 'routes', id: 'r1', data: { id: 'r1', tripId: 't1', name: 'Monte Baldo', color: '#16a34a', kind: 'track', date: '2026-07-04', notes: 'Parkplatz Geheimtipp', showInShare: true, filename: 'tour.fit', original: ref('voll-1'), stats: { distance: 12345, ascent: 850, descent: 840, duration: 14400 }, preview: Array.from({ length: 1000 }, (_, i) => [45.7 + i * 0.0001, 10.8, 1000 + i]), points: [] } },
    { tbl: 'routes', id: 'r2', data: { id: 'r2', tripId: 't1', name: 'Privat', color: '#000000', kind: 'route', date: '', showInShare: false, stats: {}, preview: [[1, 1, null], [2, 2, null]] } },
    { tbl: 'websites', id: 't1', data: { tripId: 't1', template: 'magazin', accent: '#be123c', font: 'lora', dark: true, title: 'Sommer am See', subtitle: 'Juli 2026', intro: 'Hallo!', author: 'Marco', showMood: true, showLocation: true } }
  ].map((c) => ({ ...c, stamp }))
  await call('POST', '/api/push', KEY, { changes })
})

after(async () => {
  await new Promise((r) => server.close(r))
  rmSync(dir, { recursive: true, force: true })
})

test('Lese-Link nur Highlights: nur freigegebene Inhalte, nichts Privates', async () => {
  const s = await call('POST', '/api/shares', KEY, { tripId: 't1', mode: 'highlights' })
  assert.equal(s.status, 201)
  assert.match(s.body.token, /^[A-Za-z0-9_-]{22}$/)
  const pub = await call('GET', `/api/public/${s.body.token}`)
  assert.equal(pub.status, 200)
  assert.equal(pub.body.title, 'Sommer am See')
  assert.equal(pub.body.look.template, 'magazin')
  assert.equal(pub.body.look.font, 'lora')
  assert.deepEqual(pub.body.entries.map((e) => e.title), ['Seeblick'])
  const raw = JSON.stringify(pub.body)
  for (const secret of ['47113', 'Birgit', 'privat', 'Pizza', 'Geheim', 'Regentag', 'Parkplatz', 'tour.fit', 'Privat']) assert.ok(!raw.includes(secret), `${secret} darf nicht drin sein`)
  assert.equal(pub.body.routes.length, 1)
  assert.equal(pub.body.routes[0].name, 'Monte Baldo')
  assert.equal(pub.body.routes[0].date, '2026-07-04')
  assert.ok(pub.body.routes[0].points.length <= 600)
  assert.ok(!('original' in pub.body.routes[0]) && !('notes' in pub.body.routes[0]))
  // Foto aus freigegebenem Eintrag ja, aus anderem nein
  const ok = await fetch(`${base}/api/public/${s.body.token}/photo/p1`)
  assert.equal(ok.status, 200)
  assert.equal(await ok.text(), 'voll-1')
  assert.equal(await (await fetch(`${base}/api/public/${s.body.token}/photo/p1?size=thumb`)).text(), 'klein-1')
  assert.equal((await fetch(`${base}/api/public/${s.body.token}/photo/p2`)).status, 404)
})

test('Lese-Link ganzes Tagebuch, ohne Fotos', async () => {
  const s = await call('POST', '/api/shares', KEY, { tripId: 't1', mode: 'journal', photos: false, title: 'Für Oma' })
  const pub = await call('GET', `/api/public/${s.body.token}`)
  assert.deepEqual(pub.body.entries.map((e) => e.title), ['Seeblick', 'Regentag'])
  assert.equal(pub.body.title, 'Für Oma')
  assert.equal(pub.body.entries[0].photos.length, 0)
  assert.equal((await fetch(`${base}/api/public/${s.body.token}/photo/p1`)).status, 404)
  const noRoutes = await call('POST', '/api/shares', KEY, { tripId: 't1', routes: false })
  assert.equal((await call('GET', `/api/public/${noRoutes.body.token}`)).body.routes.length, 0)
})

test('Passwort: ohne/falsch abgelehnt, richtig mit Foto-Ticket', async () => {
  const s = await call('POST', '/api/shares', KEY, { tripId: 't1', mode: 'highlights', password: 'Sonne' })
  assert.equal(s.body.password, true)
  const no = await call('GET', `/api/public/${s.body.token}`)
  assert.equal(no.status, 401)
  assert.equal(no.body.needPassword, true)
  assert.equal((await call('GET', `/api/public/${s.body.token}`, null, null, { 'X-Share-Password': 'Regen' })).status, 401)
  const yes = await call('GET', `/api/public/${s.body.token}`, null, null, { 'X-Share-Password': 'Sonne' })
  assert.equal(yes.status, 200)
  assert.ok(yes.body.ticket)
  assert.equal((await fetch(`${base}/api/public/${s.body.token}/photo/p1`)).status, 401)
  assert.equal((await fetch(`${base}/api/public/${s.body.token}/photo/p1?t=${yes.body.ticket}`)).status, 200)
  assert.equal((await fetch(`${base}/api/public/${s.body.token}/photo/p1?t=123.falsch`)).status, 401)
})

test('Widerrufen, Ablauf, Löschen, Zugriffszähler', async () => {
  const s = await call('POST', '/api/shares', KEY, { tripId: 't1' })
  await call('GET', `/api/public/${s.body.token}`)
  let list = (await call('GET', '/api/shares?tripId=t1', KEY)).body.shares
  assert.equal(list.find((x) => x.token === s.body.token).accessCount, 1)

  await call('PATCH', `/api/shares/${s.body.token}`, KEY, { revoked: true })
  assert.equal((await call('GET', `/api/public/${s.body.token}`)).status, 410)
  await call('PATCH', `/api/shares/${s.body.token}`, KEY, { revoked: false, mode: 'journal' })
  assert.equal((await call('GET', `/api/public/${s.body.token}`)).body.entries.length, 2)

  const e = await call('POST', '/api/shares', KEY, { tripId: 't1', expiresDays: 7 })
  assert.ok(e.body.expires > new Date().toISOString())

  assert.equal((await call('DELETE', `/api/shares/${s.body.token}`, KEY)).status, 200)
  assert.equal((await call('GET', `/api/public/${s.body.token}`)).status, 404)
  list = (await call('GET', '/api/shares?tripId=t1', KEY)).body.shares
  assert.ok(!list.some((x) => x.token === s.body.token))
})

test('Fremde Gruppe sieht und ändert keine Links', async () => {
  const s = await call('POST', '/api/shares', KEY, { tripId: 't1' })
  assert.equal((await call('GET', '/api/shares', OTHER)).body.shares.length, 0)
  assert.equal((await call('PATCH', `/api/shares/${s.body.token}`, OTHER, { revoked: true })).status, 404)
  assert.equal((await call('DELETE', `/api/shares/${s.body.token}`, OTHER)).status, 404)
  assert.equal((await call('POST', '/api/shares', OTHER, { tripId: 't1' })).status, 400, 'fremde Reise')
})

test('Unsinnige Links und Eingaben', async () => {
  assert.equal((await call('GET', '/api/public/kurz')).status, 404)
  assert.equal((await call('GET', '/api/public/AAAAAAAAAAAAAAAAAAAAAA')).status, 404)
  assert.equal((await call('POST', '/api/shares', KEY, { tripId: 't1', mode: 'alles' })).status, 400)
  assert.equal((await call('POST', '/api/shares', KEY, {})).status, 400)
})
