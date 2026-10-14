import { describe, expect, it } from 'vitest'
import { photosForMap, positionAt } from '../logic'
import { groupByPixels } from '../../map/photo-groups'

// Tour: 10:00–11:00 Uhr (UTC), von (47.0, 12.0) nach (47.1, 12.1), ein Punkt je 10 Minuten
const T0 = Date.parse('2026-10-05T10:00:00Z') / 1000
const track = Array.from({ length: 7 }, (_, i) => [47 + i / 60, 12 + i / 60, 1000, T0 + i * 600] as const)
const blob = new Blob(['x'])

describe('Fotos auf der Karte', () => {
  it('Position zur Aufnahmezeit aus der Tour (zwischen zwei Punkten gemittelt)', () => {
    const p = positionAt([track], T0 + 900) // 10:15 → zwischen Punkt 1 und 2
    expect(p?.[0]).toBeCloseTo(47 + 1.5 / 60, 5)
    expect(p?.[1]).toBeCloseTo(12 + 1.5 / 60, 5)
  })
  it('kurz vor dem Start / nach dem Ende: Anfangs- bzw. Endpunkt, sonst nichts', () => {
    expect(positionAt([track], T0 - 600)).toEqual([47, 12])
    expect(positionAt([track], T0 + 3600 + 600)?.[0]).toBeCloseTo(47.1, 5)
    expect(positionAt([track], T0 - 3600)).toBeNull()
    expect(positionAt([track], T0 + 3 * 3600)).toBeNull()
  })
  it('große Lücke in der Aufzeichnung → nicht raten', () => {
    const gap = [track[0], track[6]].map((p, i) => [p[0], p[1], p[2], T0 + i * 7200] as const)
    expect(positionAt([gap], T0 + 3600)).toBeNull()
  })
  it('Touren ohne Zeiten (geplante Routen) zählen nicht', () => {
    expect(positionAt([track.map((p) => [p[0], p[1], p[2], null] as const)], T0 + 900)).toBeNull()
  })
  it('eigener Ort hat Vorrang, sonst aus der Tour, sonst ohne Ort', () => {
    const photos = [
      { id: 'a', entryId: 'e1', caption: 'Gipfel', takenAt: '2026-10-05T10:15:00Z', thumb: blob, lat: 46.5, lon: 11.5, placeSource: 'exif' as const },
      { id: 'b', entryId: 'e1', caption: '', takenAt: '2026-10-05T10:15:00Z', thumb: blob },
      { id: 'c', entryId: 'e2', caption: '', takenAt: '2026-10-07T18:00:00Z', thumb: blob },
      { id: 'd', entryId: 'e2', caption: '', takenAt: '2026-10-07T18:00:00Z', thumb: blob, lat: 46, lon: 11, placeSource: 'karte' as const }
    ]
    const r = photosForMap('t1', photos, [{ id: 'e1', date: '2026-10-05' }, { id: 'e2', date: '2026-10-07' }], [track])
    expect(r.map((p) => [p.id, p.source, p.date])).toEqual([
      ['a', 'exif', '2026-10-05'],
      ['b', 'tour', '2026-10-05'],
      ['c', 'keiner', '2026-10-07'],
      ['d', 'karte', '2026-10-07']
    ])
    expect(r[0]).toMatchObject({ lat: 46.5, lon: 11.5, to: '/trip/t1/tagebuch/e1', caption: 'Gipfel' })
  })
  it('nahe beieinander liegende Fotos werden gruppiert', () => {
    const items = [{ lat: 0, lon: 0 }, { lat: 0, lon: 10 }, { lat: 0, lon: 100 }, { lat: 50, lon: 0 }]
    const groups = groupByPixels(items, (lat, lon) => ({ x: lon, y: lat }), 40)
    expect(groups.map((g) => g.length)).toEqual([2, 1, 1])
  })
})
