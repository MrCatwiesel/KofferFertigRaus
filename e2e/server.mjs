// Startet den Abgleich-Server für die Klicktests: App aus dist/, Daten in einem frischen Temp-Ordner.
// Die freien Kartendienste (Overpass, BRouter), das Auswärtige Amt und MeteoAlarm werden nachgebaut – die Tests brauchen kein Internet.
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyncServer } from '../server/server.mjs'

const port = Number(process.argv[2] ?? 8791)
export const KEY = 'klicktest-schluessel-1234567890'
/** Eigene Reisegruppe für den Personen-Test (stört die anderen Tests nicht) */
export const KEY2 = 'klicktest-personen-0987654321'
/** Eigene Reisegruppe für den Benachrichtigungs-Test */
export const KEY3 = 'klicktest-push-1122334455'

const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
async function fakeKartendienste(url, init = {}) {
  if (String(url).includes('overpass')) {
    const q = new URLSearchParams(String(init.body)).get('data') ?? ''
    if (q.includes('out geom')) {
      // Glocknerrunde: zwei Wegabschnitte, einer falsch herum
      const way = (pts) => ({ type: 'way', ref: 1, role: '', geometry: pts.map(([lat, lon]) => ({ lat, lon })) })
      return json({
        elements: [{ type: 'relation', id: 4711, members: [way([[47.07, 12.75], [47.075, 12.76], [47.08, 12.77]]), way([[47.09, 12.79], [47.085, 12.78], [47.08, 12.77]])] }]
      })
    }
    return json({
      elements: [
        { type: 'relation', id: 4711, tags: { name: 'Glocknerrunde', ref: 'GR', network: 'rwn', from: 'Heiligenblut', to: 'Kaprun' } },
        { type: 'relation', id: 4712, tags: { name: 'Zirbenweg', network: 'lwn' } }
      ]
    })
  }
  if (String(url).includes('brouter')) {
    const ll = new URL(String(url)).searchParams.get('lonlats').split('|').map((p) => p.split(',').map(Number))
    const coords = []
    for (let i = 0; i < ll.length - 1; i++) for (let k = 0; k <= 10; k++) {
      const [lo1, la1] = ll[i]
      const [lo2, la2] = ll[i + 1]
      coords.push([lo1 + ((lo2 - lo1) * k) / 10, la1 + ((la2 - la1) * k) / 10, 1500 + k * 20])
    }
    return json({ type: 'FeatureCollection', features: [{ properties: { 'track-length': '4200', 'filtered ascend': '200', 'total-time': '3600' }, geometry: { type: 'LineString', coordinates: coords } }] })
  }
  throw new Error(`unerwartete Anfrage: ${url}`)
}

const aaFixture = (n) => new Response(readFileSync(join(import.meta.dirname, 'fixtures', n)), { status: 200 })
async function fakeAuswaertigesAmt(url) {
  if (String(url).endsWith('/representativesInCountry')) return aaFixture('aa-vertretungen.json')
  if (String(url).endsWith('/travelwarning')) return aaFixture('aa-liste.json')
  if (String(url).endsWith('/travelwarning/210962')) return aaFixture('aa-oesterreich.json')
  return new Response('nicht da', { status: 404 })
}

/**
 * Nachgebautes MeteoAlarm (Zeiten relativ zu jetzt): Österreich mit Gewitter (orange, Umriss um Fusch),
 * Sturm (gelb, Gebiet „Zell am See“ nur als Name) und Schnee in Tirol; andere Länder ohne Warnungen.
 */
async function fakeMeteoAlarm(url) {
  if (!String(url).endsWith('/feeds-austria')) return json({ warnings: [] })
  const iso = (h) => new Date(Date.now() + h * 3600_000).toISOString()
  const alert = (id, level, type, area, code, polygon) => ({
    alert: {
      identifier: id, msgType: 'Alert', status: 'Actual', sent: iso(0),
      info: [{
        language: 'de-DE', event: type, headline: `Warnung: ${area}`, description: 'Gefahr durch Unwetter.', instruction: 'Im Haus bleiben.',
        senderName: 'GeoSphere Austria', onset: iso(-1), expires: iso(30),
        parameter: [{ valueName: 'awareness_level', value: level }, { valueName: 'awareness_type', value: type }],
        area: [{ areaDesc: area, geocode: [{ valueName: 'EMMA_ID', value: code }], ...(polygon ? { polygon: [polygon] } : {}) }]
      }]
    }
  })
  return json({
    warnings: [
      alert('e2e-gewitter', '3; orange; Severe', '3; Thunderstorm', 'Pinzgau', 'AT005', '47.0,12.5 47.5,12.5 47.5,13.0 47.0,13.0'),
      alert('e2e-sturm', '2; yellow; Moderate', '1; Wind', 'Zell am See', 'AT006'),
      alert('e2e-schnee', '2; yellow; Moderate', '2; snow-ice', 'Tirol Oberland', 'AT007')
    ]
  })
}

/** Nachgebauter Push-Dienst: nimmt jede Nachricht an (echte Dienste prüfen Abo und Schlüssel) */
const fakePushDienst = async () => new Response(null, { status: 201 })

const server = createSyncServer({
  keys: [KEY, KEY2, KEY3],
  dataDir: mkdtempSync(join(tmpdir(), 'nww-e2e-')),
  appDir: join(import.meta.dirname, '..', 'dist'),
  routing: { fetchImpl: fakeKartendienste },
  reiseinfo: { fetchImpl: fakeAuswaertigesAmt },
  push: { fetchImpl: fakePushDienst, hosts: ['push.example'] },
  unwetter: { fetchImpl: fakeMeteoAlarm }
})
server.listen(port, () => console.log(`Klicktest-Server auf ${port}`))
