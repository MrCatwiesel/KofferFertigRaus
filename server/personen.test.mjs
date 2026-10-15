import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyncServer } from './server.mjs'
import { checkPassword, hashPassword, loginOf } from './members.mjs'

const KEY = 'personen-test-schluessel-1234'
let server
let base
let dir

const call = async (method, path, token, body, raw) => {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': raw ? 'image/png' : 'application/json' },
    body: raw ?? (body ? JSON.stringify(body) : undefined)
  })
  const text = await r.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {}
  return { status: r.status, body: json }
}

const stamp = (n) => `2026-10-14T10:${String(n).padStart(2, '0')}:00.000Z`
const pullAll = async (tok) => {
  const r = await call('GET', '/api/pull?since=0&limit=1000', tok)
  assert.equal(r.status, 200, JSON.stringify(r.body))
  return new Map(r.body.changes.map((c) => [`${c.tbl}/${c.id}`, c]))
}
const visible = (map, key) => !!map.get(key) && !map.get(key).deleted

// Gemeinsamer Zustand der Testfolge
const s = {}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'nww-pers-'))
  server = createSyncServer({ keys: [KEY], dataDir: dir })
  await new Promise((r) => server.listen(0, r))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((r) => server.close(r))
  rmSync(dir, { recursive: true, force: true })
})

test('Lebenszeichen nennt die Personen-Funktion (App fragt Einladungen nur dann vorab)', async () => {
  assert.equal((await call('GET', '/api/health')).body.people, true)
})

test('Passwort-Hilfen', () => {
  const h = hashPassword('geheim-123')
  assert.ok(checkPassword('geheim-123', h))
  assert.ok(!checkPassword('geheim-124', h))
  assert.ok(!checkPassword('x', 'kaputt'))
  assert.equal(loginOf('  Birgit   Muster '), 'birgit muster')
})

test('Verwalter: eigenes Gerät wird zur ersten Person („Das bin ich“)', async () => {
  const dev = await call('POST', '/api/anmelden', KEY, { name: 'iPad Marco' })
  s.marco = dev.body.token
  const before = (await call('GET', '/api/info', s.marco)).body
  assert.equal(before.member, null)
  assert.equal(before.manager, true)

  assert.equal((await call('POST', '/api/personen', s.marco, { name: 'Marco', self: true })).status, 400, 'Passwort nötig')
  assert.equal((await call('POST', '/api/personen', s.marco, { name: 'Marco', self: true, password: 'kurz' })).status, 400)
  const r = await call('POST', '/api/personen', s.marco, { name: 'Marco', self: true, password: 'marco-passwort' })
  assert.equal(r.status, 201)
  assert.equal(r.body.member.role, 'verwalter')
  s.marcoId = r.body.member.id

  const info = (await call('GET', '/api/info', s.marco)).body
  assert.equal(info.member.name, 'Marco')
  assert.notEqual(info.epoch, before.epoch, 'Gerät gleicht nach dem Zuordnen neu ab')
})

test('Einladung für eine Person: Passwort festlegen, danach Name + Passwort', async () => {
  const r = await call('POST', '/api/personen', s.marco, { name: 'Birgit', role: 'mitglied' })
  assert.equal(r.status, 201)
  s.birgitId = r.body.member.id
  assert.equal((await call('POST', '/api/personen', s.marco, { name: 'birgit' })).status, 409, 'Name doppelt')

  const check = await call('POST', '/api/anmelden', null, { invite: r.body.invite.code, check: true })
  assert.deepEqual(check.body, { group: 'Meine Reisen', person: 'Birgit', needsPassword: true })
  assert.equal((await call('POST', '/api/anmelden', null, { invite: r.body.invite.code, name: 'Handy' })).status, 400, 'ohne Passwort')
  const login = await call('POST', '/api/anmelden', null, { invite: r.body.invite.code, name: 'Handy', password: 'birgit-passwort' })
  assert.equal(login.status, 201)
  assert.equal(login.body.member.name, 'Birgit')
  s.birgit = login.body.token

  assert.equal((await call('POST', '/api/anmelden', null, { login: 'Birgit', password: 'falsch-falsch', name: 'Laptop' })).status, 401)
  const second = await call('POST', '/api/anmelden', null, { login: ' birgit ', password: 'birgit-passwort', name: 'Laptop' })
  assert.equal(second.status, 201)
  s.birgit2 = second.body.token

  // Leserin
  const lea = await call('POST', '/api/personen', s.marco, { name: 'Lea', role: 'leser' })
  s.leaId = lea.body.member.id
  s.lea = (await call('POST', '/api/anmelden', null, { invite: lea.body.invite.code, name: 'Tablet', password: 'lea-passwort-1' })).body.token
})

test('Eigenes Passwort ändern', async () => {
  assert.equal((await call('PATCH', '/api/personen/ich', s.birgit, { oldPassword: 'falsch', password: 'neues-passwort' })).status, 400)
  assert.equal((await call('PATCH', '/api/personen/ich', s.birgit, { oldPassword: 'birgit-passwort', password: 'neu' })).status, 400)
  assert.equal((await call('PATCH', '/api/personen/ich', s.birgit, { oldPassword: 'birgit-passwort', password: 'birgit-neu-123' })).status, 200)
  assert.equal((await call('POST', '/api/anmelden', null, { login: 'Birgit', password: 'birgit-neu-123', name: 'X' })).status, 201)
  assert.equal((await call('PATCH', '/api/personen/ich', KEY, { oldPassword: 'x', password: 'yyyyyyyyy' })).status, 400)
})

test('Mitglieder sehen nur sich: keine Personen-Verwaltung, nur eigene Geräte', async () => {
  assert.equal((await call('POST', '/api/personen', s.birgit, { name: 'Fremd' })).status, 403)
  const list = await call('GET', '/api/personen', s.birgit)
  assert.equal(list.status, 200)
  assert.ok(list.body.members.every((m) => !('hasPassword' in m)))
  const devs = (await call('GET', '/api/geraete', s.birgit)).body.devices
  assert.equal(devs.length, 3)
  assert.ok(devs.every((d) => d.member === s.birgitId))
  assert.equal((await call('GET', '/api/geraete', s.marco)).body.devices.length, 5)
  // Eigene Einladung: neues Gerät gehört wieder Birgit, ohne Passwort
  const inv = (await call('POST', '/api/einladungen', s.birgit, { member: s.marcoId })).body
  assert.equal(inv.member, s.birgitId, 'nicht für andere Personen')
})

test('Private Einträge: nur für verknüpfte Person sichtbar, Freigabe an alle', async () => {
  const trip = { id: 'T1', title: 'Wien', participants: ['Marco', 'Birgit', 'Kind'], memberLinks: { Marco: s.marcoId, Birgit: s.birgitId } }
  let r = await call('POST', '/api/push', s.marco, {
    changes: [
      { tbl: 'trips', id: 'T1', stamp: stamp(1), data: trip },
      { tbl: 'trips', id: 'T2', stamp: stamp(1), data: { id: 'T2', title: 'Rom' } },
      { tbl: 'packingItems', id: 'p-marco', stamp: stamp(1), data: { id: 'p-marco', tripId: 'T1', name: 'Zahnbürste', person: 'Marco' } },
      { tbl: 'packingItems', id: 'p-kind', stamp: stamp(1), data: { id: 'p-kind', tripId: 'T1', name: 'Kuscheltier', person: 'Kind' } },
      { tbl: 'packingItems', id: 'p-alle', stamp: stamp(1), data: { id: 'p-alle', tripId: 'T1', name: 'Reiseführer', person: '' } }
    ]
  })
  assert.equal(r.body.accepted, 5)
  r = await call('POST', '/api/push', s.birgit, {
    changes: [
      { tbl: 'documents', id: 'd-inr', stamp: stamp(2), data: { id: 'd-inr', tripId: 'T1', title: 'INR-Ausweis', person: 'Birgit', sharedWith: [] } },
      { tbl: 'medications', id: 'm-b', stamp: stamp(2), data: { id: 'm-b', tripId: 'T1', name: 'Marcumar', person: 'Birgit' } }
    ]
  })
  assert.equal(r.body.accepted, 2)

  let m = await pullAll(s.marco)
  assert.ok(visible(m, 'packingItems/p-marco'))
  assert.ok(visible(m, 'packingItems/p-kind'), 'nicht verknüpfte Teilnehmer bleiben sichtbar')
  assert.ok(!visible(m, 'documents/d-inr'), 'Birgits Dokument ist privat – auch für den Verwalter')
  assert.equal(m.get('documents/d-inr').deleted, true)
  const b = await pullAll(s.birgit)
  assert.ok(!visible(b, 'packingItems/p-marco'))
  assert.ok(visible(b, 'documents/d-inr'))

  // Gruppenschlüssel (Gerät ohne Person) sieht alles
  assert.ok(visible(await pullAll(KEY), 'documents/d-inr'))

  // Birgit gibt den INR-Ausweis frei
  r = await call('POST', '/api/push', s.birgit, {
    changes: [{ tbl: 'documents', id: 'd-inr', stamp: stamp(3), data: { id: 'd-inr', tripId: 'T1', title: 'INR-Ausweis', person: 'Birgit', sharedWith: ['*'] } }]
  })
  assert.equal(r.body.accepted, 1)
  m = await pullAll(s.marco)
  assert.ok(visible(m, 'documents/d-inr'))
  assert.ok(!visible(m, 'medications/m-b'))
  assert.ok(visible(await pullAll(s.lea), 'documents/d-inr'))
})

test('Gesundheit (Allergien) ist privat wie Medikamente – Freigabe an alle für den Notfall', async () => {
  const r = await call('POST', '/api/push', s.birgit, {
    changes: [
      { tbl: 'healthProfiles', id: 'T1:gesundheit:Birgit', stamp: stamp(4), data: { id: 'T1:gesundheit:Birgit', tripId: 'T1', person: 'Birgit', allergens: ['peanuts'], sharedWith: [] } }
    ]
  })
  assert.equal(r.body.accepted, 1)
  assert.ok(!visible(await pullAll(s.marco), 'healthProfiles/T1:gesundheit:Birgit'))
  await call('POST', '/api/push', s.birgit, {
    changes: [
      { tbl: 'healthProfiles', id: 'T1:gesundheit:Birgit', stamp: stamp(5), data: { id: 'T1:gesundheit:Birgit', tripId: 'T1', person: 'Birgit', allergens: ['peanuts'], sharedWith: ['*'] } }
    ]
  })
  assert.ok(visible(await pullAll(s.marco), 'healthProfiles/T1:gesundheit:Birgit'))
  // Ändern darf es trotzdem nur Birgit
  const x = await call('POST', '/api/push', s.marco, {
    changes: [{ tbl: 'healthProfiles', id: 'T1:gesundheit:Birgit', stamp: stamp(6), data: { id: 'T1:gesundheit:Birgit', tripId: 'T1', person: 'Birgit', allergens: [], sharedWith: ['*'] } }]
  })
  assert.equal(x.body.rejected[0]?.reason, 'privat')
})

test('Fremde private Einträge ändern/löschen → abgelehnt, Server-Fassung kommt zurück', async () => {
  const r = await call('POST', '/api/push', s.marco, {
    changes: [
      { tbl: 'medications', id: 'm-b', stamp: stamp(9), deleted: true },
      { tbl: 'documents', id: 'd-inr', stamp: stamp(9), data: { id: 'd-inr', tripId: 'T1', title: 'geändert', person: 'Birgit', sharedWith: ['*'] } },
      { tbl: 'packingItems', id: 'p-kind', stamp: stamp(9), data: { id: 'p-kind', tripId: 'T1', name: 'Kuscheltier', person: 'Kind', packed: true } }
    ]
  })
  assert.equal(r.body.accepted, 1)
  assert.deepEqual(r.body.rejected.map((x) => [x.id, x.reason]), [['m-b', 'privat'], ['d-inr', 'privat']])
  assert.equal(r.body.rejected[0].current.deleted, true, 'unsichtbar → als Löschung')
  assert.equal(r.body.rejected[1].current.data.title, 'INR-Ausweis', 'freigegeben → Server-Fassung')
  assert.ok(visible(await pullAll(s.birgit), 'medications/m-b'))
})

test('Verknüpfung: fremde lösen nur die Person selbst', async () => {
  const cur = (await pullAll(s.birgit)).get('trips/T1').data
  let r = await call('POST', '/api/push', s.birgit, { changes: [{ tbl: 'trips', id: 'T1', stamp: stamp(10), data: { ...cur, memberLinks: { Birgit: s.birgitId } } }] })
  assert.equal(r.body.rejected[0]?.reason, 'verknuepfung')
  r = await call('POST', '/api/push', s.marco, { changes: [{ tbl: 'trips', id: 'T1', stamp: stamp(10), data: { ...cur, memberLinks: { Marco: s.marcoId, Birgit: s.marcoId } } }] })
  assert.equal(r.body.rejected[0]?.reason, 'verknuepfung', 'auch der Verwalter nicht')
  // Marco löst seine eigene Verknüpfung → seine Packliste wird für alle sichtbar
  r = await call('POST', '/api/push', s.marco, { changes: [{ tbl: 'trips', id: 'T1', stamp: stamp(11), data: { ...cur, memberLinks: { Birgit: s.birgitId } } }] })
  assert.equal(r.body.accepted, 1)
  const b = await call('GET', `/api/pull?since=0&limit=1000`, s.birgit)
  const p = b.body.changes.filter((c) => c.id === 'p-marco')
  assert.equal(p.length, 1)
  assert.equal(p[0].deleted, false, 'neu ausgeliefert')
})

test('Leserin: darf nichts ändern', async () => {
  const r = await call('POST', '/api/push', s.lea, {
    changes: [
      { tbl: 'packingItems', id: 'p-lea', stamp: stamp(12), data: { id: 'p-lea', tripId: 'T1', name: 'Neu', person: '' } },
      { tbl: 'trips', id: 'T9', stamp: stamp(12), data: { id: 'T9', title: 'Eigene Reise' } },
      { tbl: 'appearance', id: 'x', stamp: stamp(12), data: { id: 'x' } }
    ]
  })
  assert.equal(r.body.accepted, 0)
  assert.equal(r.body.rejected.length, 3)
  assert.ok(r.body.rejected.every((x) => x.reason === 'nur-lesen' && x.current.deleted))
})

test('Zugriff je Reise: kein Zugriff, nur lesen, bearbeiten', async () => {
  assert.equal((await call('PUT', '/api/zugriff/T1', s.birgit, { member: s.leaId, role: 'kein' })).status, 403)
  let r = await call('PUT', '/api/zugriff/T1', s.marco, { member: s.leaId, role: 'kein' })
  assert.deepEqual(r.body.access, { [s.leaId]: 'kein' })
  let l = await pullAll(s.lea)
  assert.ok(!visible(l, 'trips/T1'))
  assert.ok(!visible(l, 'packingItems/p-alle'))
  assert.ok(visible(l, 'trips/T2'))
  assert.equal((await call('GET', '/api/zugriff/T1', s.lea)).status, 404)
  assert.deepEqual((await call('GET', '/api/info', s.lea)).body.tripAccess, { T1: 'kein' })
  assert.deepEqual((await call('GET', `/api/personen/${s.leaId}/zugriff`, s.marco)).body.access, { T1: 'kein' })
  assert.equal((await call('GET', `/api/personen/${s.leaId}/zugriff`, s.birgit)).status, 403)

  // Leserin darf Rom bearbeiten
  await call('PUT', '/api/zugriff/T2', s.marco, { member: s.leaId, role: 'bearbeiten' })
  r = await call('POST', '/api/push', s.lea, { changes: [{ tbl: 'activities', id: 'a1', stamp: stamp(13), data: { id: 'a1', tripId: 'T2', title: 'Kolosseum' } }] })
  assert.equal(r.body.accepted, 1)
  // … aber eine Unternehmung nicht in die gesperrte Reise verschieben
  r = await call('POST', '/api/push', s.lea, { changes: [{ tbl: 'activities', id: 'a1', stamp: stamp(14), data: { id: 'a1', tripId: 'T1', title: 'Kolosseum' } }] })
  assert.equal(r.body.rejected[0]?.reason, 'nur-lesen')

  // Birgit nur lesen in Rom
  await call('PUT', '/api/zugriff/T2', s.marco, { member: s.birgitId, role: 'lesen' })
  r = await call('POST', '/api/push', s.birgit, { changes: [{ tbl: 'activities', id: 'a1', stamp: stamp(15), deleted: true }] })
  assert.equal(r.body.rejected[0]?.reason, 'nur-lesen')
  assert.equal(r.body.rejected[0].current.data.title, 'Kolosseum')

  // Zurück auf die Gruppenrolle → Lea bekommt Wien wieder
  await call('PUT', '/api/zugriff/T1', s.marco, { member: s.leaId, role: null })
  l = await pullAll(s.lea)
  assert.ok(visible(l, 'trips/T1'))
})

test('Fotos nur, wenn ein sichtbarer Eintrag darauf verweist', async () => {
  const png = Buffer.from('89504e470d0a1a0a-foto', 'utf8')
  const hash = createHash('sha256').update(png).digest('hex')
  assert.equal((await call('PUT', `/api/blob/${hash}`, s.birgit, null, png)).status, 201)
  await call('POST', '/api/push', s.birgit, {
    changes: [{ tbl: 'documents', id: 'd-scan', stamp: stamp(16), data: { id: 'd-scan', tripId: 'T1', title: 'Scan', person: 'Birgit', file: { __blobRef: hash, type: 'image/png' } } }]
  })
  assert.equal((await call('GET', `/api/blob/${hash}`, s.birgit)).status, 200)
  assert.equal((await call('GET', `/api/blob/${hash}`, s.marco)).status, 404)
  assert.equal((await call('GET', `/api/blob/${hash}`, KEY)).status, 200)
})

test('Lese-Links nur mit Bearbeiten-Recht', async () => {
  assert.equal((await call('POST', '/api/shares', s.birgit, { tripId: 'T2' })).status, 403)
  assert.equal((await call('POST', '/api/shares', s.birgit, { tripId: 'T1' })).status, 201)
  assert.equal((await call('GET', '/api/shares?tripId=T1', s.lea)).body.shares.length, 1)
})

test('Sperren und Entfernen meldet die Geräte ab; letzter Verwalter bleibt', async () => {
  assert.equal((await call('PATCH', `/api/personen/${s.marcoId}`, s.marco, { role: 'mitglied' })).status, 400)
  assert.equal((await call('DELETE', `/api/personen/${s.marcoId}`, s.marco)).status, 400)
  let r = await call('PATCH', `/api/personen/${s.leaId}`, s.marco, { disabled: true })
  assert.equal(r.body.member.disabled, true)
  assert.equal((await call('GET', '/api/info', s.lea)).status, 401)
  r = await call('DELETE', `/api/personen/${s.birgitId}`, s.marco)
  assert.equal(r.status, 200)
  assert.equal((await call('GET', '/api/info', s.birgit2)).status, 401)
  // Birgits Einträge sind nicht mehr privat (Verknüpfung zeigt ins Leere)
  assert.ok(visible(await pullAll(s.marco), 'medications/m-b'))
  // Passwort zurücksetzen: neue Einladung für eine Person mit Passwort verlangt ein neues
  const p = await call('POST', '/api/personen', s.marco, { name: 'Paul', role: 'mitglied' })
  await call('POST', '/api/anmelden', null, { invite: p.body.invite.code, name: 'A', password: 'paul-passwort' })
  const reset = await call('POST', `/api/personen/${p.body.member.id}/einladung`, s.marco)
  assert.equal((await call('POST', '/api/anmelden', null, { invite: reset.body.code, check: true })).body.needsPassword, true)
})
