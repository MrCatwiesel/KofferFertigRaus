// Startet den Abgleich-Server für die Klicktests: App aus dist/, Daten in einem frischen Temp-Ordner.
// Die freien Kartendienste (Overpass, BRouter) und das Auswärtige Amt werden nachgebaut – die Tests brauchen kein Internet.
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createSyncServer } from '../server/server.mjs'

const port = Number(process.argv[2] ?? 8791)
export const KEY = 'klicktest-schluessel-1234567890'

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
  if (String(url).endsWith('/travelwarning')) return aaFixture('aa-liste.json')
  if (String(url).endsWith('/travelwarning/210962')) return aaFixture('aa-oesterreich.json')
  return new Response('nicht da', { status: 404 })
}

const server = createSyncServer({
  keys: [KEY],
  dataDir: mkdtempSync(join(tmpdir(), 'nww-e2e-')),
  appDir: join(import.meta.dirname, '..', 'dist'),
  routing: { fetchImpl: fakeKartendienste },
  reiseinfo: { fetchImpl: fakeAuswaertigesAmt }
})
server.listen(port, () => console.log(`Klicktest-Server auf ${port}`))
