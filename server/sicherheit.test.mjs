// Prüfungen aus der unabhängigen Code-Durchsicht (Oktober 2026)
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyncServer } from './server.mjs'

const OWNER = 'besitzer-schluessel-sicher-1'
let server, base, dir
const sha = (b) => createHash('sha256').update(b).digest('hex')
const call = async (method, path, key, body, extra = {}) => {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { ...(key ? { Authorization: `Bearer ${key}` } : {}), ...(body && typeof body === 'object' ? { 'Content-Type': 'application/json' } : {}), ...extra },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
  })
  return { status: r.status, headers: r.headers, body: await r.json().catch(() => null) }
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'nww-sicher-'))
  server = createSyncServer({ keys: [OWNER], dataDir: dir })
  await new Promise((r) => server.listen(0, r))
  base = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  await new Promise((r) => server.close(r))
  rmSync(dir, { recursive: true, force: true })
})

test('Hochgeladene „Webseite“ wird nie als Seite ausgeliefert', async () => {
  const { body: g } = await call('POST', '/api/admin/groups', OWNER, { name: 'Fremde' })
  const evil = '<html><script>alert(1)</script></html>'
  assert.equal((await call('PUT', `/api/blob/${sha(evil)}`, g.key, evil, { 'Content-Type': 'text/html' })).status, 201)
  const get = await fetch(`${base}/api/blob/${sha(evil)}`, { headers: { Authorization: `Bearer ${g.key}` } })
  assert.equal(get.headers.get('content-type'), 'application/octet-stream')
  assert.match(get.headers.get('content-security-policy') ?? '', /sandbox/)
  assert.equal(get.headers.get('content-disposition'), 'attachment')

  // Als „Foto“ in einen Lese-Link gepackt → öffentlich nicht abrufbar
  const ref = { __blobRef: sha(evil), type: 'image/jpeg' }
  const stamp = '2026-07-10T10:00:00Z'
  await call('POST', '/api/push', g.key, {
    changes: [
      { tbl: 'trips', id: 't9', stamp, data: { id: 't9', title: 'X', destination: 'Y', startDate: '2026-07-01', endDate: '2026-07-02' } },
      { tbl: 'journalEntries', id: 'e9', stamp, data: { id: 'e9', tripId: 't9', date: '2026-07-01', title: 'a', text: '', highlight: true, photoIds: ['p9'], location: 'Geheimort', createdAt: stamp } },
      { tbl: 'photos', id: 'p9', stamp, data: { id: 'p9', tripId: 't9', entryId: 'e9', full: ref, thumb: ref, width: 1, height: 1 } },
      { tbl: 'websites', id: 't9', stamp, data: { tripId: 't9', showLocation: false } }
    ]
  })
  const s = await call('POST', '/api/shares', g.key, { tripId: 't9', mode: 'highlights', photos: true })
  const pub = await call('GET', `/api/public/${s.body.token}`)
  assert.equal(pub.status, 200)
  assert.equal(pub.body.entries[0].location, '', 'Ort wird nicht verschickt, wenn er nicht gezeigt wird')
  assert.equal((await fetch(`${base}/api/public/${s.body.token}/photo/p9`)).status, 404)

  // Gruppe sperren → Link gilt nicht mehr; Kalender-Abo nach dem Löschen weg
  const link = await call('POST', '/api/kalender/link', g.key)
  const cal = link.body.token
  assert.equal((await fetch(`${base}/api/kalender/${cal}.ics`)).status, 200)
  await call('PATCH', `/api/admin/groups/${g.group.space}`, OWNER, { disabled: true })
  assert.equal((await call('GET', `/api/public/${s.body.token}`)).status, 410)
  assert.equal((await fetch(`${base}/api/kalender/${cal}.ics`)).status, 404)
  await call('DELETE', `/api/admin/groups/${g.group.space}`, OWNER)
  assert.equal((await fetch(`${base}/api/kalender/${cal}.ics`)).status, 404)
})

test('Zeitstempel aus der Zukunft blockieren spätere Änderungen nicht', async () => {
  await call('POST', '/api/push', OWNER, { changes: [{ tbl: 'trips', id: 'tz', stamp: '9999-01-01T00:00:00Z', data: { id: 'tz', title: 'alt' } }] })
  const later = new Date(Date.now() + 60_000).toISOString()
  const r = await call('POST', '/api/push', OWNER, { changes: [{ tbl: 'trips', id: 'tz', stamp: later, data: { id: 'tz', title: 'neu' } }] })
  assert.equal(r.body.accepted, 1)
})
