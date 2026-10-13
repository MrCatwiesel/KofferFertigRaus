import { describe, expect, it } from 'vitest'
import { daysPerMonth, summarize, tripLength, yearsOf, type TripExtra, type TripIn } from '../logic'

const trips: TripIn[] = [
  { id: 'a', title: 'Maria Alm', destination: 'Maria Alm', startDate: '2026-10-04', endDate: '2026-10-09', countries: ['AT'] },
  { id: 'b', title: 'Gardasee', destination: 'Malcesine', startDate: '2026-06-28', endDate: '2026-07-03', countries: ['IT'] },
  { id: 'c', title: 'Wien', destination: 'Wien', startDate: '2025-05-01', endDate: '2025-05-04', countries: ['AT'] },
  { id: 'd', title: 'Kreta', destination: 'Kreta', startDate: '2026-12-20', endDate: '2026-12-30', countries: ['GR'] }
]
const ex = (over: Partial<TripExtra>): TripExtra => ({ routes: [], photos: 0, entries: 0, nights: 0, spent: {}, location: null, ...over })
const extra = new Map<string, TripExtra>([
  ['a', ex({ routes: [{ name: 'Glockner', distance: 47548, ascent: 2025 }, { name: 'Klamm', distance: 3261, ascent: 141 }], photos: 60, entries: 6, nights: 5, spent: { EUR: 300.5 } })],
  ['b', ex({ routes: [{ name: 'Monte Baldo', distance: 12000, ascent: 1400 }], photos: 20, entries: 4, nights: 5, spent: { EUR: 100, CHF: 50 } })],
  ['c', ex({ photos: 5, entries: 1, nights: 3 })]
])

describe('Reisestatistik', () => {
  it('Länge und Jahre', () => {
    expect(tripLength('2026-10-04', '2026-10-09')).toBe(6)
    expect(yearsOf(trips)).toEqual([2026, 2025])
  })
  it('Jahr 2026: nur begonnene Reisen, geplante getrennt', () => {
    const s = summarize(trips, extra, 2026, '2026-10-13')
    expect(s.trips).toBe(2)
    expect(s.planned).toBe(1)
    expect(s.days).toBe(12)
    expect(s.countries).toEqual(['AT', 'IT'])
    expect(s.distance).toBe(62809)
    expect(s.ascent).toBe(3566)
    expect(s.photos).toBe(80)
    expect(s.nights).toBe(10)
    expect(s.spent).toEqual({ EUR: 400.5, CHF: 50 })
    expect(s.longestRoute).toEqual({ name: 'Glockner', trip: 'Maria Alm', distance: 47548 })
    expect(s.highestRoute?.name).toBe('Glockner')
    expect(s.rows.map((r) => r.id)).toEqual(['a', 'b'])
    // Gardasee über den Monatswechsel: 3 Tage Juni, 3 Tage Juli
    expect(s.months[5]).toBe(3)
    expect(s.months[6]).toBe(3)
    expect(s.months[9]).toBe(6)
  })
  it('Alle Jahre', () => {
    const s = summarize(trips, extra, null, '2026-10-13')
    expect(s.trips).toBe(3)
    expect(s.countries).toEqual(['AT', 'IT'])
    expect(s.longestTrip?.id).toBe('a')
  })
  it('laufende Reise zählt nur bis heute', () => {
    expect(daysPerMonth([trips[0]], 2026, '2026-10-06')[9]).toBe(3)
  })
})
