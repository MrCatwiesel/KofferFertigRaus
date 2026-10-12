import { describe, expect, it } from 'vitest'
import { parseRouteFile, detectFormat, baseName } from '../parse'
import { parseFit } from '../parse/fit'
import {
  computeStats, dateOf, formatDistance, formatDuration, gpxFileName, haversine, profileSvg, simplify, simplifyTo, statsLine, toGpx, trackSvg
} from '../logic'
import type { TrackPoint } from '../types'

const enc = (s: string) => new TextEncoder().encode(s)

const GPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Garmin GPSMAP 66sr" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Archiv</name></metadata>
  <wpt lat="47.1" lon="12.8"><name>Gipfel</name></wpt>
  <trk><name>Pasterze &amp; Gamsgrube</name><trkseg>
    <trkpt lat="47.0751" lon="12.7530"><ele>2369.2</ele><time>2026-07-04T08:00:00Z</time></trkpt>
    <trkpt lon="12.7545" lat="47.0760"><ele>2380.0</ele><time>2026-07-04T08:05:00Z</time></trkpt>
  </trkseg><trkseg>
    <trkpt lat="47.0772" lon="12.7561"><ele>2410.4</ele><time>2026-07-04T08:12:00Z</time><extensions><gpxtpx:hr>110</gpxtpx:hr></extensions></trkpt>
    <trkpt lat="0" lon="0"/>
  </trkseg></trk>
  <rte><name>Großglockner Hochalpenstraße</name>
    <rtept lat="47.2861" lon="12.7988"/><rtept lat="47.0447" lon="12.8443"/><rtept lat="47.0216" lon="12.8519"/>
  </rte>
</gpx>`

const KML = `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2"><Document><name>Meine Karte</name>
<Placemark><name>Treffpunkt</name><Point><coordinates>12.8,47.1,0</coordinates></Point></Placemark>
<Placemark><name>Fahrt über den Pass</name><LineString><tessellate>1</tessellate><coordinates>
  12.7988,47.2861,0 12.8443,47.0447,0
  12.8519,47.0216,0
</coordinates></LineString></Placemark>
<Placemark><name>Aufzeichnung</name><gx:Track><when>2026-07-05T10:00:00Z</when><when>2026-07-05T10:10:00Z</when>
<gx:coord>11.5 47.2 1200</gx:coord><gx:coord>11.51 47.21 1250</gx:coord></gx:Track></Placemark>
</Document></kml>`

const TCX = `<?xml version="1.0"?><TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Hiking"><Id>2026-07-06T07:00:00Z</Id><Lap><Track>
<Trackpoint><Time>2026-07-06T07:00:00Z</Time><Position><LatitudeDegrees>47.3</LatitudeDegrees><LongitudeDegrees>11.4</LongitudeDegrees></Position><AltitudeMeters>600</AltitudeMeters></Trackpoint>
<Trackpoint><Time>2026-07-06T07:30:00Z</Time><Position><LatitudeDegrees>47.31</LatitudeDegrees><LongitudeDegrees>11.41</LongitudeDegrees></Position><AltitudeMeters>700</AltitudeMeters></Trackpoint>
</Track></Lap></Activity></Activities></TrainingCenterDatabase>`

const GEOJSON = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: 'Uferweg' }, geometry: { type: 'LineString', coordinates: [[10.8, 45.9, 70], [10.81, 45.91, 75]] } },
    { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [10.8, 45.9] } }
  ]
})

/** Kleine FIT-Datei wie von einer Fenix: Aktivität mit 3 Punkten, einer davon mit komprimierter Zeit. */
function makeFit(fileType = 4): Uint8Array {
  const out: number[] = []
  const u8 = (v: number) => out.push(v & 0xff)
  const u16 = (v: number) => (u8(v), u8(v >> 8))
  const u32 = (v: number) => (u16(v & 0xffff), u16(v >>> 16))
  const semi = (deg: number) => Math.round((deg * 2 ** 31) / 180) >>> 0
  const FIT_EPOCH = 631065600
  const t0 = Date.parse('2026-07-04T08:00:00Z') / 1000 - FIT_EPOCH
  // file_id (lokal 0, global 0): Feld 0 type (enum)
  u8(0x40); u8(0); u8(0); u16(0); u8(1); u8(0); u8(1); u8(0x00)
  u8(0x00); u8(fileType)
  // record (lokal 1): timestamp, lat, lon, enhanced_altitude
  u8(0x41); u8(0); u8(0); u16(20); u8(4)
  u8(253); u8(4); u8(0x86); u8(0); u8(4); u8(0x85); u8(1); u8(4); u8(0x85); u8(78); u8(4); u8(0x86)
  const rec = (t: number, la: number, lo: number, alt: number) => {
    u8(0x01); u32(t); u32(semi(la)); u32(semi(lo)); u32(Math.round((alt + 500) * 5))
  }
  rec(t0, 47.0751, 12.753, 2369.2)
  rec(t0 + 300, 47.076, 12.7545, 2380)
  // record ohne Zeitfeld (lokal 2) mit komprimierter Zeit (+20 s)
  u8(0x42); u8(0); u8(0); u16(20); u8(3)
  u8(0); u8(4); u8(0x85); u8(1); u8(4); u8(0x85); u8(2); u8(2); u8(0x84)
  const off = ((t0 + 320) & 0x1f)
  u8(0x80 | (2 << 5) | off); u32(semi(47.0772)); u32(semi(12.7561)); u16(Math.round((2410.4 + 500) * 5))
  const data = out.slice()
  const header = [14, 0x20, 0x08, 0x08, ...[0, 0, 0, 0], 0x2e, 0x46, 0x49, 0x54, 0, 0]
  const size = data.length
  header[4] = size & 0xff; header[5] = (size >> 8) & 0xff; header[6] = (size >> 16) & 0xff; header[7] = (size >> 24) & 0xff
  return new Uint8Array([...header, ...data, 0, 0])
}

async function makeKmz(kml: string): Promise<Uint8Array> {
  const raw = enc(kml)
  const comp = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer())
  const name = enc('doc.kml')
  const le16 = (v: number) => [v & 0xff, (v >> 8) & 0xff]
  const le32 = (v: number) => [...le16(v & 0xffff), ...le16(v >>> 16)]
  // Lokaler Kopf: Signatur, Version, Flags, Methode 8, Zeit, Datum, CRC, Größen, Namenslänge, Extra
  const local = [...le32(0x04034b50), ...le16(20), ...le16(0), ...le16(8), ...le16(0), ...le16(0), ...le32(0), ...le32(comp.length), ...le32(raw.length), ...le16(name.length), ...le16(0), ...name, ...comp]
  // Zentralverzeichnis
  const cd = [...le32(0x02014b50), ...le16(20), ...le16(20), ...le16(0), ...le16(8), ...le16(0), ...le16(0), ...le32(0), ...le32(comp.length), ...le32(raw.length),
    ...le16(name.length), ...le16(0), ...le16(0), ...le16(0), ...le16(0), ...le32(0), ...le32(0), ...name]
  const eocd = [...le32(0x06054b50), ...le16(0), ...le16(0), ...le16(1), ...le16(1), ...le32(cd.length), ...le32(local.length), ...le16(0)]
  return new Uint8Array([...local, ...cd, ...eocd])
}

describe('Routen lesen', () => {
  it('GPX: Spur mit allen Segmenten und Route, Wegpunkte und 0/0 ignoriert', async () => {
    const r = await parseRouteFile('Current.gpx', enc(GPX))
    expect(r.format).toBe('gpx')
    expect(r.routes).toHaveLength(2)
    const [trk, rte] = r.routes
    expect(trk.name).toBe('Pasterze & Gamsgrube')
    expect(trk.kind).toBe('track')
    expect(trk.points).toHaveLength(3)
    expect(trk.points[1]).toEqual([47.076, 12.7545, 2380, Date.parse('2026-07-04T08:05:00Z') / 1000])
    expect(rte.name).toBe('Großglockner Hochalpenstraße')
    expect(rte.kind).toBe('route')
    expect(rte.points[0][2]).toBeNull()
  })

  it('KML (Google My Maps): Linien und gx:Track, Punkte ignoriert', async () => {
    const r = await parseRouteFile('karte.kml', enc(KML))
    expect(r.routes.map((x) => x.name)).toEqual(['Fahrt über den Pass', 'Aufzeichnung'])
    expect(r.routes[0].points).toHaveLength(3)
    expect(r.routes[0].points[0]).toEqual([47.2861, 12.7988, 0, null])
    expect(r.routes[1].kind).toBe('track')
    expect(r.routes[1].points[1][2]).toBe(1250)
  })

  it('KMZ: gepacktes KML', async () => {
    const r = await parseRouteFile('karte.kmz', await makeKmz(KML))
    expect(r.format).toBe('kmz')
    expect(r.routes).toHaveLength(2)
  })

  it('TCX und GeoJSON', async () => {
    const t = await parseRouteFile('Wanderung.tcx', enc(TCX))
    expect(t.routes[0].points).toHaveLength(2)
    expect(t.routes[0].kind).toBe('track')
    const g = await parseRouteFile('weg.geojson', enc(GEOJSON))
    expect(g.routes).toHaveLength(1)
    expect(g.routes[0].name).toBe('Uferweg')
    expect(g.routes[0].points[1]).toEqual([45.91, 10.81, 75, null])
  })

  it('FIT (Garmin): Punkte, Höhe, Zeit – auch komprimierte Zeitstempel', async () => {
    const r = await parseRouteFile('2026-07-04-08-00-00.fit', makeFit())
    expect(r.format).toBe('fit')
    const pts = r.routes[0].points
    expect(pts).toHaveLength(3)
    expect(Math.abs(pts[0][0] - 47.0751) < 1e-5).toBe(true)
    expect(Math.abs(pts[0][1] - 12.753) < 1e-5).toBe(true)
    expect(pts[0][2]).toBe(2369.2)
    expect(pts[0][3]).toBe(Date.parse('2026-07-04T08:00:00Z') / 1000)
    expect(pts[2][3]).toBe(Date.parse('2026-07-04T08:05:20Z') / 1000)
    expect(pts[2][2]).toBe(2410.4)
    expect(r.routes[0].kind).toBe('track')
    expect(parseFit(makeFit(6), 'x')[0].kind).toBe('route')
  })

  it('erkennt Formate am Inhalt und meldet Unbekanntes', async () => {
    expect(detectFormat('x.txt', enc(GPX))).toBe('gpx')
    expect(detectFormat('x', makeFit())).toBe('fit')
    expect(baseName('2026_07_04 Tour.gpx')).toBe('2026 07 04 Tour')
    let msg = ''
    try {
      await parseRouteFile('notiz.txt', enc('hallo'))
    } catch (e) {
      msg = (e as Error).message
    }
    expect(msg).toContain('Format nicht erkannt')
  })
})

describe('Routen rechnen', () => {
  const line: TrackPoint[] = Array.from({ length: 101 }, (_, i) => [47 + i * 0.0001, 12, 1000 + Math.sin(i / 5) * 2 + i, 1_780_000_000 + i * 60])

  it('Entfernung und Kennzahlen', () => {
    expect(Math.round(haversine([47, 12], [47.01, 12]))).toBe(1112)
    const st = computeStats(line)
    expect(st.distance).toBeGreaterThan(1100)
    expect(st.distance).toBeLessThan(1125)
    expect(st.ascent).toBeGreaterThan(90)
    expect(st.ascent).toBeLessThan(110)
    expect(st.descent).toBe(0)
    expect(st.duration).toBe(6000)
    expect(st.minEle).toBe(1000)
  })

  it('Höhenrauschen zählt nicht als Aufstieg', () => {
    const noisy: TrackPoint[] = Array.from({ length: 200 }, (_, i) => [47 + i * 0.0001, 12, 500 + (i % 2 ? 2 : -2), null])
    expect(computeStats(noisy).ascent).toBe(0)
  })

  it('vereinfacht gerade Strecken stark, Kurven bleiben', () => {
    expect(simplify(line, 5)).toHaveLength(2)
    const zigzag: TrackPoint[] = Array.from({ length: 50 }, (_, i) => [47 + i * 0.001, 12 + (i % 2) * 0.001, null, null])
    expect(simplify(zigzag, 5).length).toBe(50)
    expect(simplifyTo(zigzag, 10).length).toBeLessThanOrEqual(10)
  })

  it('Datum, Anzeige, SVG, GPX-Export', () => {
    expect(dateOf([[47, 12, null, Date.parse('2026-07-04T10:00:00Z') / 1000]])).toBe('2026-07-04')
    expect(formatDistance(850)).toBe('850 m')
    expect(formatDistance(12345)).toBe('12,3 km')
    expect(formatDuration(3 * 3600 + 5 * 60)).toBe('3 h 05 min')
    expect(statsLine({ distance: 12345, ascent: 850, descent: 0, duration: null })).toBe('12,3 km · ↗ 850 m')
    expect(trackSvg(line, { color: '#2563eb' })).toContain('stroke="#2563eb"')
    expect(trackSvg(line, { color: 'red"><script>' })).not.toContain('<script>')
    expect(profileSvg(line)).toContain('Höhenprofil')
    expect(trackSvg([line[0]])).toBe('')
    const gpx = toGpx('Tour <1>', line.slice(0, 2))
    expect(gpx).toContain('<name>Tour &lt;1&gt;</name>')
    expect(gpx).toContain('<time>')
    expect(gpxFileName('Großglockner Hochalpenstraße')).toBe('grossglockner-hochalpenstrasse.gpx')
  })

  it('GPX-Export lässt sich wieder einlesen', async () => {
    const back = await parseRouteFile('x.gpx', enc(toGpx('Hin und zurück', line)))
    expect(back.routes[0].points).toHaveLength(line.length)
    expect(back.routes[0].name).toBe('Hin und zurück')
  })
})
