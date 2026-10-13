import { describe, expect, it } from 'vitest'
import { decodeText, matchesGarbled } from '../parse/text'
import { parseRouteFile } from '../parse'
import { interpolateElevations, lacksElevation } from '../logic'
import type { TrackPoint } from '../types'

const latin1 = (s: string) => Uint8Array.from([...s].map((c) => c.charCodeAt(0)))
const utf8 = (s: string) => new TextEncoder().encode(s)
const gpx = (decl: string, name: string) =>
  `<?xml version="1.0"${decl}?><gpx version="1.1" creator="x"><trk><name>${name}</name><trkseg><trkpt lat="47.07" lon="12.75"></trkpt><trkpt lat="47.08" lon="12.77"></trkpt></trkseg></trk></gpx>`

describe('Zeichenkodierung von Routendateien', () => {
  it('UTF-8 (mit und ohne BOM)', () => {
    expect(decodeText(utf8('Großglockner'))).toBe('Großglockner')
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...utf8('Öl')]))).toBe('Öl')
  })
  it('ISO-8859-1 laut XML-Kopf', async () => {
    const bytes = latin1(gpx(' encoding="ISO-8859-1"', 'Großglockner-Hochalpenstraße'))
    const r = await parseRouteFile('glockner.gpx', bytes)
    expect(r.routes[0].name).toBe('Großglockner-Hochalpenstraße')
  })
  it('Latin-1 ohne Angabe (bzw. falsche Angabe UTF-8) wird erkannt', async () => {
    expect((await parseRouteFile('a.gpx', latin1(gpx('', 'Edelweißspitze')))).routes[0].name).toBe('Edelweißspitze')
    expect((await parseRouteFile('a.gpx', latin1(gpx(' encoding="UTF-8"', 'Schwäbische Alb')))).routes[0].name).toBe('Schwäbische Alb')
  })
  it('kaputten Namen dem richtigen zuordnen', () => {
    expect(matchesGarbled('Gro�glockner-Hochalpenstra�e', 'Großglockner-Hochalpenstraße')).toBe(true)
    expect(matchesGarbled('Gro�glockner', 'Kitzsteinhorn')).toBe(false)
    expect(matchesGarbled('Großglockner', 'Großglockner')).toBe(false) // nicht kaputt
  })
})

describe('Fehlende Höhen ergänzen', () => {
  const pts: TrackPoint[] = Array.from({ length: 11 }, (_, i) => [47 + i * 0.001, 12, null, null])
  it('erkennt Strecken ohne Höhen', () => {
    expect(lacksElevation(pts)).toBe(true)
    expect(lacksElevation(pts.map((p) => [p[0], p[1], 1000, null] as TrackPoint))).toBe(false)
  })
  it('rechnet zwischen Stützstellen nach Wegstrecke', () => {
    const out = interpolateElevations(pts, [{ index: 0, ele: 1000 }, { index: 10, ele: 1100 }])
    expect(out[0][2]).toBe(1000)
    expect(out[5][2]).toBeCloseTo(1050, 0)
    expect(out[10][2]).toBe(1100)
    expect(interpolateElevations(pts, [{ index: 0, ele: null }])).toBe(pts)
  })
})
