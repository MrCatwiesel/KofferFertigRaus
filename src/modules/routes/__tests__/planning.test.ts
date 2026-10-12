import { describe, expect, it } from 'vitest'
import { geometryQuery, parseHits, relationLine, searchQuery, stitch } from '../planning/osm'
import { lonlats, parseBrouter } from '../planning/brouter'
import { hikingTime } from '../logic'

describe('Wanderwege aus OpenStreetMap', () => {
  it('baut sichere Abfragen', () => {
    const q = searchQuery([12.6, 46.95, 12.95, 47.2], 'hiking', 'Glockner "Runde"')
    expect(q).toContain('["route"~"^(hiking|foot)$"]')
    expect(q).toContain('["name"~"Glockner Runde",i]')
    expect(q).toContain('(46.95,12.6,47.2,12.95)')
    expect(searchQuery([0, 0, 1, 1], 'hiking', 'a.*b')).toContain('a\\.\\*b')
    expect(geometryQuery(123.7)).toBe('[out:json][timeout:60];relation(123);(._;rel(r););out geom;')
  })
  it('liest Treffer und sortiert wichtige Routen nach vorn', () => {
    const hits = parseHits(
      {
        elements: [
          { type: 'relation', id: 1, tags: { name: 'Zirbenweg', network: 'lwn' } },
          { type: 'relation', id: 2, tags: { name: 'Glocknerrunde', 'name:de': 'Glocknerrunde', network: 'rwn', ref: 'GR', from: 'Heiligenblut', to: 'Kaprun', website: 'javascript:x' } }
        ]
      },
      'hiking'
    )
    expect(hits.map((h) => h.name)).toEqual(['Glocknerrunde', 'Zirbenweg'])
    expect(hits[0]).toMatchObject({ ref: 'GR', networkLabel: 'regional', from: 'Heiligenblut', website: '' })
  })
  it('fügt Wegabschnitte in jeder Richtung zusammen', () => {
    const a: [number, number][] = [[47, 12], [47.001, 12.001]]
    const b: [number, number][] = [[47.002, 12.002], [47.001, 12.001]] // falsch herum
    const c: [number, number][] = [[47.002, 12.002], [47.003, 12.003]]
    expect(stitch([c, a, b])).toEqual([[47, 12], [47.001, 12.001], [47.002, 12.002], [47.003, 12.003]])
  })
  it('nimmt nur Wege einer Relation (ohne Wegweiser) und überbrückt Lücken', () => {
    const line = relationLine({
      elements: [
        {
          type: 'relation',
          id: 9,
          members: [
            { type: 'way', ref: 1, role: '', geometry: [{ lat: 47, lon: 12 }, { lat: 47.001, lon: 12 }] },
            { type: 'node', ref: 5, role: 'guidepost' },
            { type: 'way', ref: 2, role: 'platform', geometry: [{ lat: 50, lon: 10 }, { lat: 50.1, lon: 10 }] },
            { type: 'way', ref: 3, role: '', geometry: [{ lat: 47.01, lon: 12 }, { lat: 47.02, lon: 12 }] }
          ]
        }
      ]
    })
    expect(line).toEqual([[47, 12], [47.001, 12], [47.01, 12], [47.02, 12]])
  })
})

describe('Routenplaner (BRouter)', () => {
  it('schreibt Wegpunkte als Länge,Breite', () => {
    expect(lonlats([{ lat: 47.1, lon: 12.7 }, { lat: 47.2, lon: 12.8 }])).toBe('12.700000,47.100000|12.800000,47.200000')
  })
  it('liest die GeoJSON-Antwort mit Höhen, Länge, Anstieg und Zeit', () => {
    const r = parseBrouter({
      type: 'FeatureCollection',
      features: [{ properties: { 'track-length': '5230', 'filtered ascend': '412', 'total-time': '7400' }, geometry: { coordinates: [[12.7, 47.1, 1500], [12.71, 47.11, 1550.5]] } }]
    })
    expect(r.points).toEqual([[47.1, 12.7, 1500, null], [47.11, 12.71, 1550.5, null]])
    expect([r.distance, r.ascent, r.time]).toEqual([5230, 412, 7400])
    expect(() => parseBrouter({ features: [] })).toThrow(/keine Strecke/)
  })
})

describe('Gehzeit nach DIN 33466', () => {
  it('Ebene: 4 km/h', () => expect(hikingTime(8000, 0, 0)).toBe(2 * 3600))
  it('Bergtour: größere Zeit plus halbe kleinere', () => {
    // 10 km (2,5 h), 900 Hm hoch (3 h) + 900 runter (1,8 h) → 4,8 h vertikal; 4,8 + 1,25 = 6,05 h
    expect(hikingTime(10000, 900, 900)).toBe(Math.round(6.05 * 3600))
  })
})
