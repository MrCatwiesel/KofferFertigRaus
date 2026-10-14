import { describe, expect, it } from 'vitest'
import { formatRanges, openOn, parseOpeningHours, weekdayOf } from '../openingHours'
import { describeCode, parseDaily, parsePlaces } from '../weather'
import { formatSeconds, pickMime } from '../recorder'

describe('Öffnungszeiten', () => {
  // 2026-10-05 ist ein Montag
  it('Wochentag', () => {
    expect(weekdayOf('2026-10-05')).toBe(0)
    expect(weekdayOf('2026-10-11')).toBe(6)
  })
  it('deutsche Schreibweise mit Bereich', () => {
    expect(openOn('Di–So 10–18 Uhr', '2026-10-05').state).toBe('geschlossen')
    const di = openOn('Di–So 10–18 Uhr', '2026-10-06')
    expect(di.state).toBe('offen')
    expect(formatRanges(di.hours)).toBe('10–18')
  })
  it('mehrere Abschnitte, nicht genannte Tage geschlossen', () => {
    const t = 'Mo-Fr 9:00-17:30; Sa 10-14'
    expect(formatRanges(openOn(t, '2026-10-09').hours)).toBe('9–17:30')
    expect(formatRanges(openOn(t, '2026-10-10').hours)).toBe('10–14')
    expect(openOn(t, '2026-10-11').state).toBe('geschlossen')
  })
  it('OSM-Stil, täglich, Listen, Ruhetag, 24/7', () => {
    expect(openOn('Tu-Su 10:00-18:00', '2026-10-05').state).toBe('geschlossen')
    expect(openOn('täglich 9–19', '2026-10-11').state).toBe('offen')
    expect(openOn('Mo, Mi, Fr 8-12', '2026-10-07').state).toBe('offen')
    expect(openOn('Mo, Mi, Fr 8-12', '2026-10-08').state).toBe('geschlossen')
    expect(openOn('Mo-Sa 10-18; Mo geschlossen', '2026-10-05').state).toBe('geschlossen')
    expect(formatRanges(openOn('24/7', '2026-10-05').hours)).toBe('rund um die Uhr')
  })
  it('Mittagspause und über Mitternacht', () => {
    expect(formatRanges(openOn('Mo-Fr 9-12, 14-18', '2026-10-05').hours)).toBe('9–12, 14–18')
    expect(formatRanges(openOn('Fr-Mo 18-2', '2026-10-11').hours)).toBe('18–2')
  })
  it('Unverständliches bleibt unbekannt', () => {
    expect(openOn('nach Vereinbarung', '2026-10-08').state).toBe('unbekannt')
    expect(openOn('', '2026-10-08').state).toBe('unbekannt')
    expect(parseOpeningHours('ganzjährig').every((d) => d === null)).toBe(true)
  })
})

describe('Wetter', () => {
  it('wandelt die Spalten-Antwort in Tage um', () => {
    const days = parseDaily({
      daily: {
        time: ['2026-07-01', '2026-07-02'],
        weather_code: [0, 63],
        temperature_2m_max: [28.4, 19.1],
        temperature_2m_min: [16.2, 14],
        precipitation_sum: [0, 12.3],
        precipitation_probability_max: [5, null],
        wind_speed_10m_max: [10.5, 22]
      }
    })
    expect(days).toEqual([
      { date: '2026-07-01', code: 0, tempMax: 28.4, tempMin: 16.2, precipitation: 0, precipitationProbability: 5, windMax: 10.5 },
      { date: '2026-07-02', code: 63, tempMax: 19.1, tempMin: 14, precipitation: 12.3, precipitationProbability: null, windMax: 22 }
    ])
    expect(parseDaily({})).toEqual([])
  })
  it('liest Orte aus der Suche', () => {
    expect(parsePlaces({ results: [{ name: 'Riva del Garda', admin1: 'Trentino', country: 'Italien', latitude: 45.88, longitude: 10.84 }, { name: 'kaputt' }] }))
      .toEqual([{ name: 'Riva del Garda', region: 'Trentino, Italien', latitude: 45.88, longitude: 10.84 }])
    expect(parsePlaces({})).toEqual([])
  })
  it('übersetzt Wettercodes', () => {
    expect(describeCode(0).kind).toBe('sonnig')
    expect(describeCode(3).kind).toBe('wolkig')
    expect(describeCode(61).kind).toBe('regen')
    expect(describeCode(81).kind).toBe('regen')
    expect(describeCode(73).kind).toBe('schnee')
    expect(describeCode(96).kind).toBe('gewitter')
  })
})

describe('Sprachnotizen – Aufnahme', () => {
  it('nimmt die erste unterstützte Tonart (Safari mp4, sonst webm)', () => {
    expect(pickMime((t) => t.startsWith('audio/mp4'))).toBe('audio/mp4')
    expect(pickMime((t) => t.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus')
    expect(pickMime(() => false)).toBe('')
  })
  it('Zeit als m:ss', () => {
    expect(formatSeconds(0)).toBe('0:00')
    expect(formatSeconds(65.4)).toBe('1:05')
    expect(formatSeconds(900)).toBe('15:00')
  })
})
