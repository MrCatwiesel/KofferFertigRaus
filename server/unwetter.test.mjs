import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { createDecipheriv, createECDH, createHmac, randomBytes } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyncServer } from './server.mjs'
import { createUnwetterQuelle, loadRegions, parseCap, parseFeed, regionsAt, zeitraum } from './unwetter.mjs'

const fixture = (n) => readFileSync(new URL(`../e2e/fixtures/${n}`, import.meta.url), 'utf8')
const calls = []
let down = false
async function fakeFetch(url, init = {}) {
  calls.push({ url: String(url), ua: init.headers?.['User-Agent'] })
  if (down) throw new Error('offline')
  if (String(url) === 'https://ma.test/feeds/meteoalarm-legacy-atom-austria') return new Response(fixture('meteoalarm-austria.xml'))
  if (String(url) === 'https://ma.test/feeds/meteoalarm-legacy-atom-switzerland') return new Response(fixture('meteoalarm-switzerland.xml'))
  if (String(url) === 'https://ma.test/api/v1/warnings/feeds-austria/gewitter-tirol') return new Response(fixture('meteoalarm-cap-gewitter.xml'))
  return new Response('nicht da', { status: 404 })
}

const INNSBRUCK = { lat: 47.2692, lon: 11.4041 }
const WIEN = { lat: 48.2082, lon: 16.3738 }
const NOW = Date.parse('2030-07-14T09:00:00Z')

test('Regionen: Ort → Bundesland und Bezirk, Orte außerhalb ohne Region', () => {
  const regions = loadRegions()
  assert.ok(regions.length > 1900)
  assert.deepEqual(regionsAt(regions, INNSBRUCK.lat, INNSBRUCK.lon).map((r) => r.id).sort(), ['AT003', 'AT701'])
  assert.deepEqual(regionsAt(regions, 46.4983, 11.3548).map((r) => r.name), ['Trentino Alto Adige'])
  assert.deepEqual(regionsAt(regions, 52.52, 13.405).map((r) => r.id), ['DE202'])
  assert.deepEqual(regionsAt(regions, 13.75, 100.5), [], 'Bangkok: kein MeteoAlarm')
})

test('Feed lesen: Stufe aus der Farbe, Art aus dem Titel, EMMA_ID', () => {
  const e = parseFeed(fixture('meteoalarm-austria.xml'))
  assert.equal(e.length, 6)
  assert.deepEqual({ emma: e[0].emma, area: e[0].area, level: e[0].level, art: e[0].art, cap: e[0].capUrl }, { emma: 'AT003', area: 'Tirol', level: 3, art: 'gewitter', cap: 'https://ma.test/api/v1/warnings/feeds-austria/gewitter-tirol' })
  assert.equal(e[2].art, 'hitze')
  assert.equal(e[2].level, 2)
  assert.equal(e[4].level, 1, 'Grün')
  assert.equal(e[4].area, 'Kärnten')
  // EMMA_ID nur im Link (Frankreich)
  const fr = parseFeed('<feed><entry><cap:geocode><valueName>NUTS3</valueName><value>FR718</value></cap:geocode><link href="https://meteoalarm.org?geocode=EMMA_ID:FR035" hreflang="en" title="Haute Savoie"/><cap:areaDesc>Haute Savoie</cap:areaDesc><cap:severity>Moderate</cap:severity><title>Yellow Avalanches Warning issued for France - Haute Savoie</title></entry></feed>')
  assert.equal(fr[0].emma, 'FR035')
  assert.equal(fr[0].art, 'lawinen')
})

test('CAP: deutscher Text bevorzugt, Stufe und Art aus den Parametern', () => {
  const c = parseCap(fixture('meteoalarm-cap-gewitter.xml'))
  assert.equal(c.language, 'de-AT')
  assert.equal(c.event, 'Gewitter')
  assert.equal(c.headline, 'Unwetterwarnung & Hagel: schwere Gewitter')
  assert.match(c.description, /großem Hagel/)
  assert.equal(c.instruction, 'Bergtouren meiden, Schutz in Gebäuden suchen.')
  assert.equal(c.level, 3)
  assert.equal(c.art, 'gewitter')
  const en = parseCap(fixture('meteoalarm-cap-gewitter.xml').replace(/<info>\s*<language>de-AT[\s\S]*?<\/info>/, ''))
  assert.equal(en.language, 'en-GB')
})

test('Warnungen für Orte: passend zugeordnet, Doppelte, Abgelaufene und Grün weg, Text nachgeladen', async () => {
  calls.length = 0
  const q = createUnwetterQuelle({ url: 'https://ma.test/feeds/', fetchImpl: fakeFetch })
  const r = await q.warnungen([INNSBRUCK, WIEN, { lat: 13.75, lon: 100.5 }], ['AT', 'TH'], NOW)
  assert.deepEqual(r.orte[2].regionen, [])
  assert.deepEqual(r.ohneDaten, ['TH'])
  assert.deepEqual(r.fehler, [])
  const ids = r.warnungen.map((w) => `${w.art}:${w.stufe}:${w.orte.join(',')}`)
  assert.deepEqual(ids, ['gewitter:3:0', 'hitze:2:1', 'regen:2:0'], 'nach Stufe sortiert; Wind (abgelaufen) und Grün fehlen')
  const g = r.warnungen[0]
  assert.equal(g.stufeName, 'Orange')
  assert.equal(g.artName, 'Gewitter')
  assert.equal(g.ereignis, 'Gewitter')
  assert.equal(g.titel, 'Unwetterwarnung & Hagel: schwere Gewitter')
  assert.equal(g.hinweis, 'Bergtouren meiden, Schutz in Gebäuden suchen.')
  assert.equal(g.quelle, 'GeoSphere Austria')
  assert.equal(g.web, 'https://warnungen.zamg.at')
  assert.deepEqual(g.regionen, [{ id: 'AT003', name: 'Tirol' }])
  // Unbekannte Region (AT999) über den Namen „Innsbruck (Stadt)“ – CAP von fremder Adresse wird nicht geholt
  assert.deepEqual(r.warnungen[2].regionen, [{ id: 'AT701', name: 'Innsbruck (Stadt)' }])
  assert.ok(!calls.some((c) => c.url.includes('boese.example')))
  assert.ok(calls.every((c) => c.ua.startsWith('NixWieWeg/')))
  // Zwischenspeicher: zweiter Abruf ohne Netz
  const n = calls.length
  await q.warnungen([INNSBRUCK], [], NOW)
  assert.equal(calls.length, n)
})

test('Länder ohne Umrisse (Schweiz): Warnungen des Landes ohne Ort, gleiche Nachricht zusammengefasst', async () => {
  const q = createUnwetterQuelle({ url: 'https://ma.test/feeds', fetchImpl: fakeFetch })
  const r = await q.warnungen([{ lat: 46.02, lon: 7.75 }], ['CH'], NOW)
  assert.equal(r.warnungen.length, 1)
  assert.equal(r.warnungen[0].ortlos, true)
  assert.equal(r.warnungen[0].art, 'schnee')
  assert.deepEqual(r.warnungen[0].bereiche, ['Mattertal', 'Saastal'])
})

test('MeteoAlarm nicht erreichbar: Fehler je Land statt Absturz', async () => {
  const q = createUnwetterQuelle({ url: 'https://ma.test/feeds', fetchImpl: async () => { throw new Error('weg') } })
  const r = await q.warnungen([INNSBRUCK], [], NOW)
  assert.deepEqual(r.warnungen, [])
  assert.match(r.fehler[0], /AT: MeteoAlarm nicht erreichbar/)
})

test('Zeitraum in der Zeitzone des Geräts', () => {
  assert.equal(zeitraum('2030-07-14T12:00:00Z', '2030-07-14T22:00:00Z', 'Europe/Vienna', NOW), 'So. 14:00 – Mo. 00:00')
  assert.equal(zeitraum('2030-07-14T06:00:00Z', '2030-07-14T22:00:00Z', 'Europe/Vienna', NOW), 'jetzt – Mo. 00:00')
  assert.equal(zeitraum('2030-07-14T12:00:00Z', '2030-07-14T22:00:00Z', 'Europe/Vienna', NOW, 'en'), 'Sun 14:00 – Mon 00:00')
})

// ---------------------------------------------------------------- über den Server, mit Push

const KEY = 'unwetter-test-schluessel-123'
let server, base, dir
const outbox = []
const fakePush = async (url, init) => {
  outbox.push({ endpoint: String(url), body: Buffer.from(init.body), headers: init.headers })
  return new Response(null, { status: 201 })
}
const hmac = (k, d) => createHmac('sha256', k).update(d).digest()
function browser(name) {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const auth = randomBytes(16)
  const read = (body) => {
    const salt = body.subarray(0, 16)
    const idlen = body[20]
    const asPublic = body.subarray(21, 21 + idlen)
    const ikm = hmac(hmac(auth, ecdh.computeSecret(asPublic)), Buffer.concat([Buffer.from('WebPush: info\0'), ecdh.getPublicKey(), asPublic, Buffer.from([1])]))
    const prk = hmac(salt, ikm)
    const d = createDecipheriv('aes-128-gcm', hmac(prk, Buffer.from('Content-Encoding: aes128gcm\0\x01')).subarray(0, 16), hmac(prk, Buffer.from('Content-Encoding: nonce\0\x01')).subarray(0, 12))
    const data = body.subarray(21 + idlen)
    d.setAuthTag(data.subarray(-16))
    return JSON.parse(Buffer.concat([d.update(data.subarray(0, -16)), d.final()]).subarray(0, -1).toString('utf8'))
  }
  return { endpoint: `https://push.example/${name}`, keys: { p256dh: ecdh.getPublicKey().toString('base64url'), auth: auth.toString('base64url') }, read }
}
const call = async (method, path, token, body) => {
  const r = await fetch(`${base}${path}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, body: await r.json().catch(() => null) }
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'nww-unwetter-'))
  server = createSyncServer({ keys: [KEY], dataDir: dir, unwetter: { url: 'https://ma.test/feeds', fetchImpl: fakeFetch }, push: { fetchImpl: fakePush, hosts: ['push.example'], timer: false } })
  await new Promise((r) => server.listen(0, r))
  base = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  await new Promise((r) => server.close(r))
  rmSync(dir, { recursive: true, force: true })
})

test('Abruf über den Server: nur mit Zugang, Orte geprüft', async () => {
  const r = await call('GET', `/api/unwetter?orte=${INNSBRUCK.lat},${INNSBRUCK.lon}&laender=AT`, KEY)
  assert.equal(r.status, 200)
  assert.equal(r.body.orte[0].regionen.length, 2)
  assert.ok(r.body.warnungen.some((w) => w.art === 'gewitter'))
  assert.equal((await call('GET', '/api/unwetter?orte=95,10', KEY)).status, 400)
  assert.equal((await call('GET', `/api/unwetter?orte=${'1,1;'.repeat(21)}`, KEY)).status, 400)
  assert.equal((await call('GET', '/api/unwetter?orte=1,1', 'falsch-falsch-falsch')).status, 401)
  assert.equal((await call('GET', '/api/info', KEY)).body.unwetter, true)
})

test('Push: neue Warnung am Reiseort geht je einmal raus, Gelb nur auf Wunsch', async () => {
  const token = (await call('POST', '/api/anmelden', KEY, { name: 'iPad' })).body.token
  const ipad = browser('ipad')
  const abo = await call('PUT', '/api/benachrichtigungen/abo', token, { endpoint: ipad.endpoint, keys: ipad.keys })
  assert.deepEqual(abo.body.prefs, { erinnerungen: true, aenderungen: false, unwetter: true, unwetterGelb: false })
  assert.equal((await call('GET', '/api/benachrichtigungen', token)).body.unwetter, 1)

  const orte = [
    { reise: 'trip-1', titel: 'Tirol', name: 'Hotel Innsbruck', ...INNSBRUCK, von: '2030-07-15', bis: '2030-07-20' },
    { reise: 'trip-2', titel: 'Wien', name: 'Wien', ...WIEN, von: '2030-08-01', bis: '2030-08-05' }
  ]
  assert.equal((await call('PUT', '/api/unwetter/beobachten', token, { orte: [{ ...orte[0], lat: 'x' }] })).status, 400)
  assert.equal((await call('PUT', '/api/unwetter/beobachten', token, { orte, zeitzone: 'Europe/Vienna' })).body.orte, 2)
  assert.equal((await call('GET', '/api/unwetter/beobachten', token)).body.orte, 2)

  outbox.length = 0
  assert.equal(await server.unwetter.tick(NOW), 1, 'Tirol: Anreise morgen → Orange-Warnung; Gelb (Regen) nicht; Wien-Reise noch nicht dran')
  const msg = ipad.read(outbox[0].body)
  assert.equal(msg.title, '⚠️ Warnstufe Orange: Gewitter')
  assert.equal(msg.body, 'Tirol · So. 14:00 – Mo. 00:00\nReise: Tirol\nUnwetterwarnung & Hagel: schwere Gewitter')
  assert.equal(msg.url, '#/trip/trip-1/unwetter')
  assert.equal(outbox[0].headers.Urgency, 'high')
  assert.equal(await server.unwetter.tick(NOW + 600_000), 0, 'nicht doppelt')

  await call('PATCH', '/api/benachrichtigungen/abo', token, { prefs: { unwetterGelb: true } })
  assert.equal(await server.unwetter.tick(NOW + 1200_000), 0, 'Gelb-Regen war schon „gesehen“ – nicht nachträglich')

  // Ausgeschaltet → nichts
  await call('PATCH', '/api/benachrichtigungen/abo', token, { prefs: { unwetter: false } })
  await call('PUT', '/api/unwetter/beobachten', token, { orte: [{ ...orte[1], von: '2030-07-14' }], zeitzone: 'Europe/Vienna' })
  assert.equal(await server.unwetter.tick(NOW + 1800_000), 0)
  await call('PATCH', '/api/benachrichtigungen/abo', token, { prefs: { unwetter: true } })
  assert.equal(await server.unwetter.tick(NOW + 2400_000), 1, 'Wien: Hitze Gelb, jetzt gewünscht')
  assert.equal(ipad.read(outbox.at(-1).body).title, '⚠️ Warnstufe Gelb: Hitze')

  // Leere Liste löscht
  assert.equal((await call('PUT', '/api/unwetter/beobachten', token, { orte: [] })).body.orte, 0)
  assert.equal((await call('GET', '/api/unwetter/beobachten', token)).body.orte, 0)
})
