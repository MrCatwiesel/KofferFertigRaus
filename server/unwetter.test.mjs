import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createDecipheriv, createECDH, createHmac, randomBytes } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyncServer } from './server.mjs'
import { cleanWatch, inPolygon, localWhen, matchWarning, normArea, parseFeed, parsePolygon, period, timeZoneOf } from './unwetter.mjs'

const H = 3600_000

/**
 * MeteoAlarm-Antwort wie von feeds.meteoalarm.org (gekürzt), Zeiten relativ zu `t0`.
 * Gewitter orange über dem Pinzgau (mit Umriss), Sturm gelb „Zell am See“ (nur Name), Schnee gelb in Tirol,
 * dazu Grün, Abgelaufenes und eine Aufhebung, die alle wegfallen.
 */
export function feed(t0) {
  const iso = (h) => new Date(t0 + h * H).toISOString().replace('.000Z', '+00:00')
  const alert = (id, { level, type, area, codes, polygon, onset = 1, expires = 12, msgType = 'Alert', en = 'Thunderstorms' }) => ({
    uuid: `u-${id}`,
    alert: {
      identifier: id, msgType, status: 'Actual', sent: iso(0),
      info: [
        { language: 'en-GB', event: en, headline: `${en} warning`, severity: 'Severe', onset: iso(onset), expires: iso(expires), parameter: [], area: [] },
        {
          language: 'de-DE', event: `${level} ${type}`, headline: `Warnung vor ${type}`, description: `Es ist mit ${type} zu rechnen.`,
          instruction: 'Aufenthalt im Freien vermeiden.', senderName: 'GeoSphere Austria', web: 'https://warnungen.zamg.at',
          severity: 'Severe', onset: iso(onset), expires: iso(expires),
          parameter: [{ valueName: 'awareness_level', value: level }, { valueName: 'awareness_type', value: type }],
          area: [{ areaDesc: area, geocode: codes.map((c) => ({ valueName: 'EMMA_ID', value: c })), ...(polygon ? { polygon } : {}) }]
        }
      ]
    }
  })
  return {
    warnings: [
      alert('gewitter-1', { level: '3; orange; Severe', type: '3; Thunderstorm', area: 'Pinzgau', codes: ['AT005'], polygon: ['47.0,12.5 47.5,12.5 47.5,13.0 47.0,13.0 47.0,12.5'] }),
      alert('sturm-1', { level: '2; yellow; Moderate', type: '1; Wind', area: 'Zell am See', codes: ['AT006'], en: 'Wind' }),
      alert('schnee-1', { level: '2; yellow; Moderate', type: '2; snow-ice', area: 'Tirol Oberland', codes: ['AT007'], en: 'Snow' }),
      alert('gruen-1', { level: '1; green; Minor', type: '4; fog', area: 'Pinzgau', codes: ['AT005'] }),
      alert('alt-1', { level: '4; red; Extreme', type: '10; rain', area: 'Pinzgau', codes: ['AT005'], onset: -20, expires: -2 }),
      alert('weg-1', { level: '4; red; Extreme', type: '1; Wind', area: 'Pinzgau', codes: ['AT005'], msgType: 'Cancel' })
    ]
  }
}

test('Feed lesen: deutsche Fassung, Stufe und Art, nur Aktuelles ab Gelb', () => {
  const t0 = Date.UTC(2026, 6, 2, 10)
  const list = parseFeed(feed(t0), t0)
  assert.deepEqual(list.map((w) => w.id), ['gewitter-1', 'sturm-1', 'schnee-1'])
  const g = list[0]
  assert.equal(g.level, 3)
  assert.equal(g.type, 3)
  assert.equal(g.typeName, 'Gewitter')
  assert.equal(g.headline, 'Warnung vor 3; Thunderstorm')
  assert.equal(g.instruction, 'Aufenthalt im Freien vermeiden.')
  assert.equal(g.sender, 'GeoSphere Austria')
  assert.deepEqual(g.areas[0].codes, ['AT005'])
  assert.equal(g.areas[0].polygons[0].length, 5)
  assert.equal(list[2].typeName, 'Schnee und Glätte')
  // Ohne Parameter: Stufe aus der Schwere
  const bare = parseFeed({ warnings: [{ alert: { identifier: 'x', info: [{ severity: 'Moderate', area: [{ areaDesc: 'A' }] }] } }] }, t0)
  assert.equal(bare[0].level, 2)
  assert.equal(bare[0].typeName, 'Unwetter')
  assert.deepEqual(parseFeed(null), [])
  assert.deepEqual(parseFeed({ warnings: 'kaputt' }), [])
})

test('Umriss, Namen, Zuordnung', () => {
  const poly = parsePolygon('47.0,12.5 47.5,12.5 47.5,13.0 47.0,13.0')
  assert.ok(inPolygon([47.2, 12.8], poly))
  assert.ok(!inPolygon([47.6, 12.8], poly))
  assert.ok(!inPolygon([47.2, 13.1], poly))
  assert.equal(parsePolygon('1,2 3,4'), null)
  assert.equal(normArea('Landkreis Amberg-Sulzbach'), normArea('Kreis Amberg-Sulzbach'))
  assert.equal(normArea('Bezirk Zell am See'), 'zellamsee')
  assert.equal(normArea('Provincia di Trento'), 'trento')

  const t0 = Date.UTC(2026, 6, 2, 10)
  const [g, s, sn] = parseFeed(feed(t0), t0)
  const watch = cleanWatch({ points: [[47.2, 12.8]], names: ['Fusch an der Großglocknerstraße', 'Bezirk Zell am See', 'Salzburg'] })
  assert.deepEqual(matchWarning(g, watch), { how: 'ort', area: 'Pinzgau' })
  assert.deepEqual(matchWarning(s, watch), { how: 'name', area: 'Zell am See' })
  assert.equal(matchWarning(sn, watch), null)
  assert.deepEqual(matchWarning(sn, cleanWatch({ regions: ['AT007'] })), { how: 'region', area: 'Tirol Oberland' })
  assert.deepEqual(matchWarning(sn, cleanWatch({ scope: 'land' })), { how: 'land', area: 'Tirol Oberland' })
  // Kurze oder fremde Namen passen nicht zufällig
  assert.equal(matchWarning(s, cleanWatch({ names: ['See', 'Österreich'] })), null)
  // Eingaben werden begrenzt
  const w = cleanWatch({ points: [[95, 1], [47, 12], 'x'], regions: ['AT001', '<script>'], names: [1, 'ab', 'Pinzgau'] })
  assert.deepEqual(w, { scope: 'orte', points: [[47, 12]], names: ['pinzgau'], regions: ['AT001'] })
})

test('Zeitraum in der Ortszeit des Landes', () => {
  assert.equal(localWhen('2026-10-15T14:00:00+02:00'), 'Do 15.10. 14:00')
  assert.equal(localWhen('2026-10-15T12:00:00Z', timeZoneOf('PT')), 'Do 15.10. 13:00')
  assert.equal(period('2026-10-15T14:00:00+02:00', '2026-10-15T22:00:00+02:00'), 'Do 15.10. 14:00 – 22:00')
  assert.equal(period('2026-10-15T12:00:00Z', '2026-10-16T04:00:00Z', timeZoneOf('AT')), 'Do 15.10. 14:00 – Fr 16.10. 06:00')
  assert.equal(period('', '2026-10-16T06:00:00+02:00'), 'bis Fr 16.10. 06:00')
})

// ---------------------------------------------------------------- Ablauf mit Server

const b = (s) => Buffer.from(s, 'base64url')
const hmac = (k, d) => createHmac('sha256', k).update(d).digest()
function decrypt(body, uaPrivate, authSecret) {
  const salt = body.subarray(0, 16)
  const idlen = body[20]
  const asPublic = body.subarray(21, 21 + idlen)
  const ecdh = createECDH('prime256v1')
  ecdh.setPrivateKey(uaPrivate)
  const ikm = hmac(hmac(authSecret, ecdh.computeSecret(asPublic)), Buffer.concat([Buffer.from('WebPush: info\0'), ecdh.getPublicKey(), asPublic, Buffer.from([1])]))
  const prk = hmac(salt, ikm)
  const d = createDecipheriv('aes-128-gcm', hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16), hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12))
  const data = body.subarray(21 + idlen)
  d.setAuthTag(data.subarray(-16))
  return Buffer.concat([d.update(data.subarray(0, -16)), d.final()]).subarray(0, -1).toString('utf8')
}

const KEY = 'unwetter-test-schluessel-123'
let server
let base
let dir
let t0 = Date.UTC(2026, 6, 2, 10)
let feedCalls = 0
let feedDown = false
const outbox = []
const fakeFetch = async (url, init) => {
  const u = String(url)
  if (u.startsWith('https://push.example/')) {
    outbox.push({ endpoint: u, body: Buffer.from(init.body) })
    return new Response(null, { status: 201 })
  }
  if (u === 'https://meteoalarm.test/v1/feeds-austria') {
    feedCalls++
    if (feedDown) throw new Error('kein Netz')
    return new Response(JSON.stringify(feed(t0)), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }
  return new Response('nicht da', { status: 404 })
}

const call = async (method, path, token, body) => {
  const r = await fetch(`${base}${path}`, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined
  })
  return { status: r.status, body: await r.json().catch(() => null) }
}

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
  dir = mkdtempSync(join(tmpdir(), 'nww-unwetter-'))
  server = createSyncServer({
    keys: [KEY], dataDir: dir,
    push: { fetchImpl: fakeFetch, hosts: ['push.example'], timer: false },
    unwetter: { url: 'https://meteoalarm.test/v1/', fetchImpl: fakeFetch }
  })
  await new Promise((r) => server.listen(0, r))
  base = `http://127.0.0.1:${server.address().port}`
})

after(async () => {
  await new Promise((r) => server.close(r))
  rmSync(dir, { recursive: true, force: true })
})

test('Prüfen: passende Warnungen zuerst, Umrisse bleiben auf dem Server', async () => {
  assert.equal((await call('GET', '/api/health')).body.unwetter, true)
  assert.equal((await call('POST', '/api/unwetter/pruefen', null, { country: 'AT' })).status, 401)
  assert.equal((await call('POST', '/api/unwetter/pruefen', KEY, { country: 'Österreich' })).status, 400)
  const unknown = await call('POST', '/api/unwetter/pruefen', KEY, { country: 'TH' })
  assert.equal(unknown.status, 404)
  assert.equal(unknown.body.code, 'land')

  server.unwetter.clearCache()
  t0 = Date.now()
  const r = await call('POST', '/api/unwetter/pruefen', KEY, { country: 'AT', points: [[47.2, 12.8]], names: ['Bezirk Zell am See'] })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  assert.deepEqual(r.body.warnings.map((w) => [w.id, w.match?.how ?? null]), [['gewitter-1', 'ort'], ['sturm-1', 'name'], ['schnee-1', null]])
  assert.equal(r.body.warnings[0].areas[0].polygons, undefined)
  assert.deepEqual(r.body.warnings[0].areas[0].codes, ['AT005'])
  // Zwischengespeichert: zweite Anfrage holt nicht neu
  const calls = feedCalls
  await call('POST', '/api/unwetter/pruefen', KEY, { country: 'AT', scope: 'land' })
  assert.equal(feedCalls, calls)
})

test('Beobachten und Push: neue Warnungen ab der gewählten Stufe, je Gerät einmal', async () => {
  server.unwetter.clearCache()
  t0 = Date.UTC(2026, 6, 2, 10)
  s.marco = (await call('POST', '/api/anmelden', KEY, { name: 'iPad Marco' })).body.token
  s.ipad = browser('ipad')
  const abo = await call('PUT', '/api/benachrichtigungen/abo', s.marco, s.ipad)
  assert.deepEqual(abo.body.prefs, { erinnerungen: true, aenderungen: false, unwetter: true, unwetterStufe: 3 })

  const item = { trip: 't1', title: 'Großglockner', countries: ['AT', 'XX'], from: '2026-07-01', to: '2026-07-05', points: [[47.2, 12.8]], names: ['Bezirk Zell am See'] }
  assert.equal((await call('PUT', '/api/unwetter/beobachten', s.marco, { items: [{ ...item, from: 'gestern' }] })).status, 400)
  const r = await call('PUT', '/api/unwetter/beobachten', s.marco, { items: [item, { ...item, trip: 't2', scope: 'aus' }] })
  assert.equal(r.body.beobachtet, 1, 'ausgeschaltete Reise wird nicht beobachtet')

  outbox.length = 0
  assert.equal(await server.unwetter.tick(t0), 1, 'nur Orange (Standard), Gelb nicht')
  assert.deepEqual(sentTo(s.ipad)[0], {
    title: 'Großglockner: Orange – Gewitter',
    body: `Pinzgau · ${period(new Date(t0 + H).toISOString(), new Date(t0 + 12 * H).toISOString(), 'Europe/Vienna')}`,
    url: '#/trip/t1/unwetter',
    tag: 'unwetter:t1:3'
  })
  assert.equal(await server.unwetter.tick(t0 + 15 * 60_000), 0, 'nicht noch einmal')

  // Ab Gelb: jetzt auch der Sturm (Name passt), Schnee in Tirol nicht
  await call('PATCH', '/api/benachrichtigungen/abo', s.marco, { prefs: { unwetterStufe: 2 } })
  server.unwetter.clearCache()
  assert.equal(await server.unwetter.tick(t0 + 30 * 60_000), 1)
  assert.equal(sentTo(s.ipad).at(-1).title, 'Großglockner: Gelb – Sturm')

  // Ausgeschaltet → nichts
  await call('PATCH', '/api/benachrichtigungen/abo', s.marco, { prefs: { unwetter: false } })
  await call('PUT', '/api/unwetter/beobachten', s.marco, { items: [{ ...item, scope: 'land' }] })
  server.unwetter.clearCache()
  assert.equal(await server.unwetter.tick(t0 + 45 * 60_000), 0)
  await call('PATCH', '/api/benachrichtigungen/abo', s.marco, { prefs: { unwetter: true } })
  // Ganzes Land: jetzt auch der Schnee in Tirol
  assert.equal(await server.unwetter.tick(t0 + 50 * 60_000), 1)
  assert.equal(sentTo(s.ipad).at(-1).title, 'Großglockner: Gelb – Schnee und Glätte')
})

test('Nur rund um die Reise; MeteoAlarm nicht erreichbar → Zwischenspeicher bzw. still', async () => {
  server.unwetter.clearCache()
  await call('PUT', '/api/unwetter/beobachten', s.marco, { items: [{ trip: 't3', title: 'Herbst', countries: ['AT'], from: '2026-10-01', to: '2026-10-05', scope: 'land' }] })
  outbox.length = 0
  assert.equal(await server.unwetter.tick(t0), 0, 'Reise erst im Oktober')

  feedDown = true
  const r = await call('POST', '/api/unwetter/pruefen', KEY, { country: 'AT' })
  assert.equal(r.status, 502)
  feedDown = false
  t0 = Date.now()
  assert.equal((await call('POST', '/api/unwetter/pruefen', KEY, { country: 'AT' })).status, 200)
  feedDown = true
  const before = feedCalls
  assert.equal((await call('POST', '/api/unwetter/pruefen', KEY, { country: 'AT' })).status, 200, 'aus dem Zwischenspeicher')
  assert.equal(feedCalls, before)
  feedDown = false
})
