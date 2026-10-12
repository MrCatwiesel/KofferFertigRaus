import { describe, expect, it } from 'vitest'
import { bboxKm, bboxTooLarge, covers, formatMb, roundBbox } from '../offline'
import { nearestOnRoute } from '../logic'

describe('Offline-Karten: Hilfen', () => {
  const glockner: [number, number, number, number] = [12.6, 46.95, 12.95, 47.2]
  it('rechnet den Ausschnitt in km um', () => {
    expect(bboxKm(glockner)).toEqual({ width: 27, height: 28 })
  })
  it('erkennt zu große Ausschnitte', () => {
    expect(bboxTooLarge(glockner)).toBe(false)
    expect(bboxTooLarge([9, 46, 17, 49])).toBe(true)
  })
  it('prüft, ob ein Punkt drin liegt', () => {
    expect(covers(glockner, 47.07, 12.75)).toBe(true)
    expect(covers(glockner, 48.1, 11.6)).toBe(false)
  })
  it('rundet und begrenzt', () => {
    expect(roundBbox([-190, 46.123456789, 12.000004, 90])).toEqual([-180, 46.12346, 12, 85])
  })
  it('zeigt Größen lesbar', () => {
    expect(formatMb(12.34 * 1024 * 1024)).toBe('12,3 MB')
    expect(formatMb(250 * 1024 * 1024)).toBe('250 MB')
  })
})

describe('Verorten auf einer Route', () => {
  it('nimmt den nächsten Punkt der Route (Längengrade nach Breite gewichtet)', () => {
    const route: [number, number][] = [
      [47.0, 12.7],
      [47.05, 12.75],
      [47.1, 12.8]
    ]
    expect(nearestOnRoute(route, 47.052, 12.749)).toEqual([47.05, 12.75])
    expect(nearestOnRoute(route, 48, 13)).toEqual([47.1, 12.8])
  })
})
