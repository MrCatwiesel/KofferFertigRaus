import { describe, expect, it } from 'vitest'
import { aktuelle, betrifftReise, imZeitfenster, reiseOrte, wo, zusammenfassung } from '../logic'
import type { UnwetterStand, Warnung } from '../types'

const trip = { startDate: '2030-07-15', endDate: '2030-07-22' }

const warnung = (over: Partial<Warnung> = {}): Warnung => ({
  id: 'w1',
  land: 'AT',
  stufe: 3,
  stufeName: 'Orange',
  art: 'gewitter',
  artName: 'Gewitter',
  ereignis: 'Gewitter',
  beginn: '2030-07-15T12:00:00Z',
  ende: '2030-07-15T22:00:00Z',
  regionen: [{ id: 'AT003', name: 'Tirol' }],
  bereiche: ['Tirol'],
  orte: [0],
  ortlos: false,
  ...over
})

const stand = (warnungen: Warnung[]): UnwetterStand => ({
  tripId: 't1',
  fetchedAt: '2030-07-15T08:00:00Z',
  orte: [
    { name: 'Hotel Innsbruck', lat: 47.27, lon: 11.4, von: '2030-07-15', bis: '2030-07-18', quelle: 'unterkunft', regionen: [{ id: 'AT003', name: 'Tirol', land: 'AT' }] },
    { name: 'Hütte Wien', lat: 48.2, lon: 16.37, von: '2030-07-18', bis: '2030-07-22', quelle: 'unterkunft', regionen: [{ id: 'AT010', name: 'Wien', land: 'AT' }] }
  ],
  warnungen,
  ohneDaten: [],
  fehler: []
})

describe('Zeitfenster', () => {
  it('ab 7 Tage vor der Reise bis zum letzten Tag', () => {
    expect(imZeitfenster(trip, '2030-07-07')).toBe(false)
    expect(imZeitfenster(trip, '2030-07-08')).toBe(true)
    expect(imZeitfenster(trip, '2030-07-22')).toBe(true)
    expect(imZeitfenster(trip, '2030-07-23')).toBe(false)
  })
})

describe('Orte der Reise', () => {
  it('Unterkünfte mit Zeitraum, Wetter-Ort für die ganze Reise, nahe Orte einmal', () => {
    const orte = reiseOrte({
      trip,
      unterkuenfte: [
        { name: 'Hotel', lat: 47.27, lon: 11.4, checkIn: '2030-07-15', checkOut: '2030-07-18' },
        { name: 'Pension', lat: 47.271, lon: 11.401, checkIn: '2030-07-18', checkOut: '2030-07-20' },
        { name: 'Hütte', lat: 47.1, lon: 11.2, checkIn: '', checkOut: '' }
      ],
      wetter: { name: 'Innsbruck', lat: 47.268, lon: 11.399 },
      ziel: { name: 'Tirol', lat: 47, lon: 11 }
    })
    expect(orte).toEqual([
      { name: 'Hotel', lat: 47.27, lon: 11.4, von: '2030-07-15', bis: '2030-07-22', quelle: 'unterkunft' },
      { name: 'Hütte', lat: 47.1, lon: 11.2, von: '2030-07-15', bis: '2030-07-22', quelle: 'unterkunft' }
    ])
  })
  it('nur ohne andere Orte das gesuchte Reiseziel', () => {
    expect(reiseOrte({ trip, unterkuenfte: [], wetter: null, ziel: { name: 'Riva', lat: 45.88, lon: 10.84 } })).toEqual([
      { name: 'Riva', lat: 45.88, lon: 10.84, von: '2030-07-15', bis: '2030-07-22', quelle: 'ziel' }
    ])
    expect(reiseOrte({ trip, unterkuenfte: [], wetter: null, ziel: null })).toEqual([])
  })
})

describe('Warnungen', () => {
  it('abgelaufene weg, am Ort vor „irgendwo im Land“, dann nach Stufe', () => {
    const now = Date.parse('2030-07-15T13:00:00Z')
    const list = aktuelle(stand([
      warnung({ id: 'alt', ende: '2030-07-15T10:00:00Z' }),
      warnung({ id: 'gelb', stufe: 2 }),
      warnung({ id: 'land', stufe: 4, ortlos: true, orte: [] }),
      warnung({ id: 'rot', stufe: 4 })
    ]), now)
    expect(list.map((w) => w.id)).toEqual(['rot', 'gelb', 'land'])
  })
  it('betrifft die Reise nur, wenn man an dem Tag dort ist', () => {
    const s = stand([])
    expect(betrifftReise(warnung(), s)).toBe(true)
    expect(betrifftReise(warnung({ orte: [1] }), s)).toBe(false) // Wien erst ab dem 18.
    expect(betrifftReise(warnung({ orte: [1], beginn: '2030-07-17T20:00:00Z', ende: '2030-07-18T06:00:00Z' }), s)).toBe(true)
    expect(betrifftReise(warnung({ ortlos: true, orte: [] }), s)).toBe(true)
  })
  it('Kurzfassung für die Reiseseite', () => {
    expect(zusammenfassung([])).toBe('Keine Warnungen an den Reiseorten')
    expect(zusammenfassung([warnung(), warnung({ id: 'w2', stufe: 2 })])).toBe('Orange: Gewitter (Tirol) · 1 weitere')
    expect(zusammenfassung([warnung({ ortlos: true, regionen: [] })])).toBe('Keine Warnung an den Reiseorten (1 sonst im Land)')
    expect(wo(warnung({ regionen: [], bereiche: ['A', 'B', 'C', 'D', 'E'] }))).toBe('A, B, C, D …')
  })
})
