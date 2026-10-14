import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createDecipheriv, createECDH, createHmac, createPublicKey, randomBytes, verify } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyncServer } from './server.mjs'
import { changeSummary, encryptPayload, validEndpoint, vapidAuth, vapidFromJwk } from './benachrichtigungen.mjs'

const b = (s) => Buffer.from(s, 'base64url')
const hmac = (k, d) => createHmac('sha256', k).update(d).digest()

/** Gegenstück zu encryptPayload – so entschlüsselt der Browser */
function decrypt(body, uaPrivate, authSecret) {
  const salt = body.subarray(0, 16)
  const idlen = body[20]
  const asPublic = body.subarray(21, 21 + idlen)
  const ecdh = createECDH('prime256v1')
  ecdh.setPrivateKey(uaPrivate)
  const uaPublic = ecdh.getPublicKey()
  const shared = ecdh.computeSecret(asPublic)
  const ikm = hmac(hmac(authSecret, shared), Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic, Buffer.from([1])]))
  const prk = hmac(salt, ikm)
  const cek = hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16)
  const nonce = hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12)
  const data = body.subarray(21 + idlen)
  const d = createDecipheriv('aes-128-gcm', cek, nonce)
  d.setAuthTag(data.subarray(-16))
  const plain = Buffer.concat([d.update(data.subarray(0, -16)), d.final()])
  assert.equal(plain.at(-1), 2, 'Begrenzer des letzten Datensatzes')
  return plain.subarray(0, -1).toString('utf8')
}

test('Verschlüsselung entspricht dem Beispiel aus RFC 8291 (Anhang A)', () => {
  const body = encryptPayload(b('V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24'), {
    p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    auth: 'BTBZMqHH6r4Tts7J_aSIgg'
  }, { asPrivate: b('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw'), salt: b('DGv6ra1nlYgDCS1FRnbzlw') })
  // Der RFC füllt nicht auf und nutzt rs = 4096 – das Ergebnis muss Byte für Byte gleich sein
  assert.equal(body.toString('base64url'),
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN')
  assert.equal(decrypt(body, b('q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94'), b('BTBZMqHH6r4Tts7J_aSIgg')), 'When I grow up, I want to be a watermelon')
})

test('Verschlüsselung: Hin und zurück, Umlaute, ungültige Schlüssel', () => {
  const ua = createECDH('prime256v1')
  ua.generateKeys()
  const auth = randomBytes(16)
  const keys = { p256dh: ua.getPublicKey().toString('base64url'), auth: auth.toString('base64url') }
  const text = JSON.stringify({ title: 'Stornofrist Hütte – übermorgen', body: 'Ölberg 👍' })
  assert.equal(decrypt(encryptPayload(text, keys), ua.getPrivateKey(), auth), text)
  assert.throws(() => encryptPayload('x', { ...keys, auth: 'kurz' }), /auth/)
  assert.throws(() => encryptPayload('x', { ...keys, p256dh: 'AAAA' }), /p256dh/)
  assert.throws(() => encryptPayload('x'.repeat(5000), keys), /zu lang/)
})

test('VAPID: Token ist mit dem Server-Schlüssel signiert und nennt den Push-Dienst', () => {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const pub = ecdh.getPublicKey()
  const jwk = { kty: 'EC', crv: 'P-256', d: ecdh.getPrivateKey().toString('base64url'), x: pub.subarray(1, 33).toString('base64url'), y: pub.subarray(33).toString('base64url') }
  const vapid = vapidFromJwk(jwk)
  assert.equal(vapid.publicKey, pub.toString('base64url'))
  const now = Date.UTC(2026, 9, 14, 12)
  const h = vapidAuth('https://web.push.apple.com/QGuQyavXutnMHT', vapid, 'mailto:test@example.org', now)
  const m = h.match(/^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/)
  assert.ok(m, h)
  assert.equal(m[4], vapid.publicKey)
  const claims = JSON.parse(b(m[2]).toString())
  assert.deepEqual(claims, { aud: 'https://web.push.apple.com', exp: now / 1000 + 12 * 3600, sub: 'mailto:test@example.org' })
  const key = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y }, format: 'jwk' })
  assert.ok(verify('sha256', Buffer.from(`${m[1]}.${m[2]}`), { key, dsaEncoding: 'ieee-p1363' }, b(m[3])))
})

test('Nur echte Push-Dienste (kein Weiterleiten ins Heimnetz)', () => {
  assert.ok(validEndpoint('https://web.push.apple.com/abc'))
  assert.ok(validEndpoint('https://fcm.googleapis.com/fcm/send/abc'))
  assert.ok(validEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc'))
  assert.ok(validEndpoint('https://wns2-par02p.notify.windows.com/w/?token=abc'))
  assert.ok(!validEndpoint('http://web.push.apple.com/abc'), 'nur https')
  assert.ok(!validEndpoint('https://192.168.5.19/abc'))
  assert.ok(!validEndpoint('https://push.apple.com.boese.example/abc'))
  assert.ok(!validEndpoint('https://user:pw@fcm.googleapis.com/x'))
  assert.ok(!validEndpoint('kein Link'))
})

test('Texte für Änderungen anderer', () => {
  assert.equal(changeSummary({ journalEntries: { neu: 1, geaendert: 0 }, photos: { neu: 5, geaendert: 0 } }), 'Neu: ein Tagebucheintrag, 5 Fotos')
  assert.equal(changeSummary({ activities: { neu: 1, geaendert: 2 }, expenses: { neu: 0, geaendert: 1 } }), 'Neu: eine Unternehmung · 3 Änderungen')
  assert.equal(changeSummary({ routes: { neu: 0, geaendert: 1 } }), '1 Änderung')
  assert.equal(changeSummary({ journalEntries: { neu: 1, geaendert: 0 }, photos: { neu: 5, geaendert: 2 } }, 'en'), 'New: a journal entry, 5 photos · 2 changes')
})

// ---------------------------------------------------------------- Ablauf mit Server

const KEY = 'push-test-schluessel-123456'
let server
let base
let dir
/** Vom Server „verschickte“ Nachrichten: { endpoint, headers, body } */
const outbox = []
/** Antwort des nachgebauten Push-Dienstes je Adresse (Standard 201) */
const replies = new Map()
const fakePush = async (url, init) => {
  outbox.push({ endpoint: String(url), headers: init.headers, body: Buffer.from(init.body) })
  return new Response(null, { status: replies.get(String(url)) ?? 201 })
}

const call = async (method, path, token, body) => {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  const text = await r.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {}
  return { status: r.status, body: json }
}

/** Ein Gerät mit Browser-Abo (eigene Schlüssel zum Entschlüsseln) */
function browser(name) {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const auth = randomBytes(16)
  return {
    endpoint: `https://push.example/${name}`,
    keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') },
    read: (msg) => JSON.parse(decrypt(msg.body, ecdh.getPrivateKey(), auth))
  }
}
const sentTo = (br) => outbox.filter((m) => m.endpoint === br.endpoint).map((m) => br.read(m))
const s = {}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'nww-push-'))
  server = createSyncServer({ keys: [KEY], dataDir: dir, push: { fetchImpl: fakePush, hosts: ['push.example'], timer: false } })
  await new Promise((r) => server.listen(0, r))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((r) => server.close(r))
  rmSync(dir, { recursive: true, force: true })
})

test('Lebenszeichen nennt Push, Server hat einen festen öffentlichen Schlüssel', async () => {
  assert.equal((await call('GET', '/api/health')).body.push, true)
  const r = await call('GET', '/api/benachrichtigungen', KEY)
  assert.equal(r.status, 200)
  assert.equal(b(r.body.publicKey).length, 65)
  assert.equal(r.body.abo, null)
  assert.equal((await call('GET', '/api/benachrichtigungen', KEY)).body.publicKey, r.body.publicKey)
  assert.equal((await call('GET', '/api/benachrichtigungen')).status, 401)
})

test('Abo nur mit Geräte-Anmeldung und nur für Push-Dienste', async () => {
  s.ipad = browser('ipad')
  assert.equal((await call('PUT', '/api/benachrichtigungen/abo', KEY, s.ipad)).status, 400, 'Gruppenschlüssel ohne Gerät')
  s.marco = (await call('POST', '/api/anmelden', KEY, { name: 'iPad Marco' })).body.token
  assert.equal((await call('PUT', '/api/benachrichtigungen/abo', s.marco, { ...s.ipad, endpoint: 'https://192.168.5.1/x' })).status, 400)
  assert.equal((await call('PUT', '/api/benachrichtigungen/abo', s.marco, { ...s.ipad, keys: { p256dh: 'AAAA', auth: 'AAAA' } })).status, 400)
  const r = await call('PUT', '/api/benachrichtigungen/abo', s.marco, s.ipad)
  assert.equal(r.status, 200)
  assert.deepEqual(r.body.prefs, { erinnerungen: true, aenderungen: false, unwetter: true, unwetterGelb: false })
  const st = (await call('GET', '/api/benachrichtigungen', s.marco)).body
  assert.equal(st.abo.endpointHost, 'push.example')
  assert.equal(st.geraete, 1)
})

test('Testnachricht kommt verschlüsselt beim Gerät an', async () => {
  const r = await call('POST', '/api/benachrichtigungen/test', s.marco)
  assert.equal(r.status, 200, JSON.stringify(r.body))
  const msg = outbox.at(-1)
  assert.equal(msg.headers['Content-Encoding'], 'aes128gcm')
  assert.match(msg.headers.Authorization, /^vapid t=.+, k=/)
  assert.equal(s.ipad.read(msg).title, 'Nix wie weg')
  // App auf Englisch: Sprache wird am Abo gemerkt, Nachrichten kommen englisch
  assert.equal((await call('PATCH', '/api/benachrichtigungen/abo', s.marco, { lang: 'en' })).body.prefs.lang, 'en')
  await call('POST', '/api/benachrichtigungen/test', s.marco)
  assert.equal(s.ipad.read(outbox.at(-1)).body, 'Notifications are working 👍')
  await call('PATCH', '/api/benachrichtigungen/abo', s.marco, { lang: 'de' })
  assert.ok((await call('GET', '/api/benachrichtigungen', s.marco)).body.abo.lastOk)
})

test('Zeitplan: fällige Erinnerungen gehen an die Geräte der Person – je einmal', async () => {
  // Birgit als Person mit eigenem Handy; Marco wird erste Person
  await call('POST', '/api/personen', s.marco, { name: 'Marco', self: true, password: 'marco-passwort' })
  const inv = await call('POST', '/api/personen', s.marco, { name: 'Birgit', role: 'mitglied' })
  s.birgitId = inv.body.member.id
  s.birgit = (await call('POST', '/api/anmelden', null, { invite: inv.body.invite.code, name: 'Handy', password: 'birgit-passwort' })).body.token
  s.handy = browser('handy')
  assert.equal((await call('PUT', '/api/benachrichtigungen/abo', s.birgit, s.handy)).status, 200)

  const t0 = Date.UTC(2026, 9, 20, 8)
  const iso = (min) => new Date(t0 + min * 60_000).toISOString()
  const items = [
    { id: 'acc:1:storno', at: iso(-10), title: 'Stornofrist Hütte', body: 'Übermorgen', url: '#/trip/t1/termine' },
    { id: 'leg:2:abfahrt', at: iso(120), title: 'Abfahrt Zug', url: 'javascript:alert(1)' },
    { id: 'alt', at: iso(-8 * 60), title: 'Längst vorbei' }
  ]
  const r = await call('PUT', '/api/benachrichtigungen/zeitplan', s.marco, { items })
  assert.equal(r.status, 200)
  assert.equal(r.body.geplant, 3)
  assert.equal((await call('PUT', '/api/benachrichtigungen/zeitplan', s.marco, { items: [{ id: 'x', at: 'morgen', title: 'x' }] })).status, 400)

  outbox.length = 0
  assert.deepEqual(await server.benachrichtigungen.tick(t0), { erinnerungen: 1, aenderungen: 0 })
  const got = sentTo(s.ipad)
  assert.equal(got.length, 1, 'zu spät (über 6 Stunden) geht nicht mehr raus')
  assert.deepEqual(got[0], { title: 'Stornofrist Hütte', body: 'Übermorgen', url: '#/trip/t1/termine', tag: 'acc:1:storno' })
  assert.equal(sentTo(s.handy).length, 0, 'Birgit bekommt Marcos Erinnerungen nicht')

  // Gleicher Zeitplan noch einmal hochgeladen → nichts doppelt
  await call('PUT', '/api/benachrichtigungen/zeitplan', s.marco, { items })
  assert.equal((await server.benachrichtigungen.tick(t0 + 60_000)).erinnerungen, 0)
  // Zwei Stunden später: Abfahrt, Link ohne fremde Adresse
  assert.equal((await server.benachrichtigungen.tick(t0 + 121 * 60_000)).erinnerungen, 1)
  assert.equal(sentTo(s.ipad).at(-1).url, '')
})

test('Erinnerungen abgeschaltet → nichts; Push-Dienst meldet „weg“ → Abo vergessen', async () => {
  const t0 = Date.UTC(2026, 9, 21, 8)
  await call('PUT', '/api/benachrichtigungen/zeitplan', s.birgit, { items: [{ id: 'a', at: new Date(t0).toISOString(), title: 'Impfung' }, { id: 'b', at: new Date(t0 + 3600_000).toISOString(), title: 'Fähre' }] })
  assert.equal((await call('PATCH', '/api/benachrichtigungen/abo', s.birgit, { prefs: { erinnerungen: false } })).body.prefs.erinnerungen, false)
  outbox.length = 0
  await server.benachrichtigungen.tick(t0)
  assert.equal(sentTo(s.handy).length, 0)

  await call('PATCH', '/api/benachrichtigungen/abo', s.birgit, { prefs: { erinnerungen: true } })
  replies.set(s.handy.endpoint, 410)
  await server.benachrichtigungen.tick(t0 + 3600_000)
  assert.equal(outbox.length, 1)
  assert.equal((await call('GET', '/api/benachrichtigungen', s.birgit)).body.abo, null, 'Abo gelöscht')
  replies.delete(s.handy.endpoint)
  assert.equal((await call('PUT', '/api/benachrichtigungen/abo', s.birgit, s.handy)).status, 200)
})

test('Änderungen anderer: gebündelt, nicht an sich selbst, nur Sichtbares', async () => {
  await call('PATCH', '/api/benachrichtigungen/abo', s.marco, { prefs: { aenderungen: true } })
  await call('PATCH', '/api/benachrichtigungen/abo', s.birgit, { prefs: { aenderungen: true } })
  const stamp = new Date().toISOString()
  const ch = (tbl, id, data) => ({ tbl, id, stamp, deleted: false, data })
  // Marco legt die Reise an – Birgit sieht sie
  await call('POST', '/api/push', s.marco, { changes: [ch('trips', 't1', { id: 't1', title: 'Dolomiten', memberLinks: { Marco: (await call('GET', '/api/info', s.marco)).body.member.id } })] })
  // Birgit schreibt Tagebuch und lädt Fotos; dazu ein privates Dokument von Marco
  await call('POST', '/api/push', s.birgit, { changes: [ch('journalEntries', 'j1', { id: 'j1', tripId: 't1' }), ch('photos', 'p1', { id: 'p1', tripId: 't1' }), ch('photos', 'p2', { id: 'p2', tripId: 't1' })] })
  await call('POST', '/api/push', s.marco, { changes: [ch('documents', 'd1', { id: 'd1', tripId: 't1', person: 'Marco', title: 'Allergiepass' })] })

  outbox.length = 0
  const t = Date.now()
  assert.equal((await server.benachrichtigungen.tick(t)).aenderungen, 0, 'erst ein paar Minuten sammeln')
  await server.benachrichtigungen.tick(t + 4 * 60_000)
  const toMarco = sentTo(s.ipad)
  assert.equal(toMarco.length, 1)
  assert.deepEqual(toMarco[0], { title: 'Dolomiten: Birgit', body: 'Neu: ein Tagebucheintrag, 2 Fotos', url: '#/trip/t1', tag: 'trip:t1' })
  // Birgit: Anlegen der Reise zählt nicht, Marcos privates Dokument sieht sie nicht
  const toBirgit = sentTo(s.handy)
  assert.equal(toBirgit.length, 0, 'Reise selbst zählt nicht, Dokument ist privat')

  // Gleich danach noch ein Foto → wartet die 15 Minuten ab
  await call('POST', '/api/push', s.birgit, { changes: [ch('photos', 'p3', { id: 'p3', tripId: 't1' })] })
  await server.benachrichtigungen.tick(t + 8 * 60_000)
  assert.equal(sentTo(s.ipad).length, 1)
  await server.benachrichtigungen.tick(t + 20 * 60_000)
  assert.equal(sentTo(s.ipad).length, 2)
  assert.equal(sentTo(s.ipad).at(-1).body, 'Neu: ein Foto')
})

test('Kein Zugriff auf die Reise → keine Nachricht; abgemeldetes Gerät → keine Nachricht', async () => {
  await call('PUT', `/api/zugriff/t1`, s.marco, { member: s.birgitId, role: 'kein' })
  const stamp = new Date().toISOString()
  await call('POST', '/api/push', s.marco, { changes: [{ tbl: 'activities', id: 'a1', stamp, deleted: false, data: { id: 'a1', tripId: 't1' } }] })
  outbox.length = 0
  await server.benachrichtigungen.tick(Date.now() + 60 * 60_000)
  assert.equal(sentTo(s.handy).length, 0)

  // Abmelden: Gerät bekommt nichts mehr
  const devs = (await call('GET', '/api/geraete', s.birgit)).body.devices
  const handy = devs.find((d) => d.name === 'Handy')
  assert.equal((await call('DELETE', `/api/geraete/${handy.id}`, s.marco)).status, 200)
  await call('PUT', '/api/benachrichtigungen/zeitplan', s.birgit, { items: [] }).catch(() => null)
  await call('PUT', `/api/zugriff/t1`, s.marco, { member: s.birgitId, role: null })
  outbox.length = 0
  const t1 = Date.now() + 2 * 3600_000
  await call('POST', '/api/push', s.marco, { changes: [{ tbl: 'activities', id: 'a2', stamp: new Date().toISOString(), deleted: false, data: { id: 'a2', tripId: 't1' } }] })
  await server.benachrichtigungen.tick(t1)
  assert.equal(sentTo(s.handy).length, 0)
})
