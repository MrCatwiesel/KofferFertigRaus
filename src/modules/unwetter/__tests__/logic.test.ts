import { describe, expect, it } from 'vitest'
import { buildWatch, inWatchWindow, namesFromAddress, otherWarnings, overlapsDay, period, relevantWarnings, settingsOf, summaryText, toggleRegion } from '../logic'
import type { WarningCache, WeatherWarning } from '../types'

const warning = (over: Partial<WeatherWarning> = {}): WeatherWarning => ({
  id: 'w', level: 2, type: 1, typeName: 'Sturm', event: '', headline: '', description: '', instruction: '', onset: '2026-07-02T10:00:00+02:00',
  expires: '2099-01-01T00:00:00+01:00', sender: '', web: '', areas: [{ name: 'Pinzgau', codes: ['AT005'] }], match: { how: 'ort', area: 'Pinzgau' }, ...over
})

describe('Unwetterwarnungen', () => {
  it('Einstellung mit Standardwerten', () => {
    expect(settingsOf({})).toEqual({ scope: 'orte', regions: [], regionNames: {} })
    expect(settingsOf({ weatherAlerts: { scope: 'land', regions: ['AT005'] } }).scope).toBe('land')
  })

  it('Zeitraum für den automatischen Abruf: drei Tage vorher bis Reiseende', () => {
    const t = { startDate: '2026-07-10', endDate: '2026-07-15' }
    expect(inWatchWindow(t, '2026-07-06')).toBe(false)
    expect(inWatchWindow(t, '2026-07-07')).toBe(true)
    expect(inWatchWindow(t, '2026-07-15')).toBe(true)
    expect(inWatchWindow(t, '2026-07-16')).toBe(false)
  })

  it('Ortsnamen aus Adressen ohne Nummern und Länder', () => {
    const skip = new Set(['österreich'])
    expect(namesFromAddress('Fusch 12, Bezirk Zell am See, Salzburg, 5672, Österreich', skip)).toEqual(['Bezirk Zell am See', 'Salzburg'])
    expect(namesFromAddress('', skip)).toEqual([])
  })

  it('Beobachtung aus Orten, Wetter-Ort, Reiseziel und Unterkünften', () => {
    const w = buildWatch(
      { scope: 'orte', regions: ['AT007'] },
      {
        destination: 'Fusch, Österreich',
        countryNames: ['Österreich', 'Austria'],
        places: [
          { lat: 47.2311, lon: 12.8234, label: 'Hotel, Fusch an der Großglocknerstraße, Bezirk Zell am See, Salzburg, Österreich' },
          { lat: 47.2312, lon: 12.8231, label: 'Parkplatz, Bezirk Zell am See' }
        ],
        weatherPlace: { name: 'Zell am See', region: 'Salzburg, Österreich', latitude: 47.32, longitude: 12.79 },
        addresses: ['Fusch 12']
      }
    )
    expect(w.points).toEqual([[47.23, 12.82], [47.32, 12.79]])
    expect(w.names).toEqual(['Hotel', 'Fusch an der Großglocknerstraße', 'Bezirk Zell am See', 'Salzburg', 'Parkplatz', 'Zell am See', 'Fusch'])
    expect(w.regions).toEqual(['AT007'])
  })

  it('Passende und weitere Warnungen, Kurzfassung', () => {
    const now = Date.parse('2026-07-02T12:00:00Z')
    const cache: WarningCache = {
      tripId: 't1', checkedAt: '', errors: [],
      countries: [{
        country: 'AT', fetchedAt: '', warnings: [
          warning({ id: 'a' }),
          warning({ id: 'b', level: 3, type: 3, typeName: 'Gewitter' }),
          warning({ id: 'c', match: null, typeName: 'Schnee und Glätte' }),
          warning({ id: 'd', expires: '2026-07-02T08:00:00+00:00' })
        ]
      }]
    }
    expect(relevantWarnings(cache, now).map((w) => w.id)).toEqual(['b', 'a'])
    expect(otherWarnings(cache, now).map((w) => w.id)).toEqual(['c'])
    expect(summaryText(cache, now)).toBe('⚠️ 2 Warnungen · Orange: Gewitter')
    expect(summaryText({ ...cache, countries: [] }, now)).toBe('Keine Warnungen für eure Orte')
  })

  it('Zeitraum in der Zeitzone des Geräts', () => {
    const tz = 'Europe/Berlin'
    expect(period('2026-10-15T14:00:00+02:00', '2026-10-15T22:00:00+02:00', tz)).toBe('Do 15.10. 14:00 – 22:00')
    expect(period('2026-10-15T12:00:00Z', '2026-10-16T04:00:00Z', tz)).toBe('Do 15.10. 14:00 – Fr 16.10. 06:00')
    expect(period('2026-10-15T14:00:00+02:00', '2026-10-15T22:00:00+02:00', 'Europe/Lisbon')).toBe('Do 15.10. 13:00 – 21:00')
    expect(period('', '')).toBe('')
  })

  it('Warnung an einem Tag', () => {
    const w = warning({ onset: new Date(2026, 6, 2, 18).toISOString(), expires: new Date(2026, 6, 3, 6).toISOString() })
    expect(overlapsDay(w, '2026-07-01')).toBe(false)
    expect(overlapsDay(w, '2026-07-02')).toBe(true)
    expect(overlapsDay(w, '2026-07-03')).toBe(true)
    expect(overlapsDay(w, '2026-07-04')).toBe(false)
  })

  it('Region beobachten und wieder entfernen', () => {
    const a = toggleRegion({ scope: 'orte', regions: [] }, 'AT005', 'Pinzgau')
    expect(a).toEqual({ scope: 'orte', regions: ['AT005'], regionNames: { AT005: 'Pinzgau' } })
    expect(toggleRegion(a, 'AT005', '')).toEqual({ scope: 'orte', regions: [], regionNames: {} })
  })
})
