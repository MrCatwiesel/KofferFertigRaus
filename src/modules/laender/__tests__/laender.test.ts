import { describe, expect, it } from 'vitest'
import { allCountries } from '@/core/countries'
import { FACTS } from '../data'
import {
  alcoholText,
  countrySummary,
  emergencyRows,
  formatDifference,
  plugFit,
  sheetCountries,
  sheetSummary,
  speedRows,
  timeDifference,
  utcOffset,
  voltageHint
} from '../logic'

describe('Länderdaten', () => {
  const known = new Set(allCountries().map((c) => c.code))
  it.each(Object.entries(FACTS))('%s ist vollständig und stimmig', (code, f) => {
    expect(known.has(code), 'bekannter Ländercode').toBe(true)
    expect(f.plugs).toMatch(/^[A-O]( [A-O])*$/)
    expect(f.volt).toBeGreaterThanOrEqual(100)
    expect(f.volt).toBeLessThanOrEqual(240)
    expect(f.dial).toMatch(/^\d{1,3}$/)
    expect(Object.values(f.emergency).length, 'mindestens eine Notrufnummer').toBeGreaterThan(0)
    for (const n of Object.values(f.emergency)) expect(n).toMatch(/^\d{2,5}$/)
    if (f.tz) expect(() => new Intl.DateTimeFormat('en', { timeZone: f.tz })).not.toThrow()
    if (f.speed) for (const s of f.speed) expect(s).toMatch(/^(|–|\d{2,3}(–\d{2,3})?)$/)
    if (f.alcohol !== undefined) expect(f.alcohol).toBeLessThanOrEqual(0.8)
    if (f.alcoholNew !== undefined) expect(f.alcoholNew).toBeLessThanOrEqual(f.alcohol ?? 1)
    if (f.tollNote) expect(f.toll).toBeDefined()
  })
  it('enthält die üblichen Reiseländer', () => {
    for (const c of ['AT', 'CH', 'IT', 'FR', 'ES', 'PT', 'NL', 'DK', 'HR', 'GR', 'GB', 'US', 'TH']) expect(FACTS[c], c).toBeDefined()
  })
})

describe('Strom', () => {
  it('Schuko passt in E/F, Eurostecker in C/J/L, sonst Adapter', () => {
    expect(plugFit('C F')).toBe('passt')
    expect(plugFit('C E')).toBe('passt')
    expect(plugFit('C J')).toBe('euro')
    expect(plugFit('C F L')).toBe('passt')
    expect(plugFit('G')).toBe('adapter')
    expect(plugFit('A B')).toBe('adapter')
    expect(plugFit('I')).toBe('adapter')
  })
  it('warnt nur bei niedriger Spannung', () => {
    expect(voltageHint(120)).toContain('100–240')
    expect(voltageHint(230)).toBeNull()
  })
})

describe('Zeit', () => {
  it('rechnet Sommer- und Winterzeit richtig', () => {
    const summer = new Date('2026-07-01T12:00:00Z')
    const winter = new Date('2026-01-15T12:00:00Z')
    expect(utcOffset('Europe/Berlin', summer)).toBe(120)
    expect(utcOffset('Europe/Berlin', winter)).toBe(60)
    expect(utcOffset('Asia/Kolkata', winter)).toBe(330)
    expect(timeDifference('Europe/Lisbon', summer, 'Europe/Berlin')).toBe(-60)
    expect(timeDifference('Asia/Bangkok', winter, 'Europe/Berlin')).toBe(360)
    expect(timeDifference('Asia/Bangkok', summer, 'Europe/Berlin')).toBe(300)
    expect(timeDifference('Europe/Rome', summer, 'Europe/Berlin')).toBe(0)
  })
  it('beschreibt den Unterschied', () => {
    expect(formatDifference(0)).toBe('gleiche Zeit wie zu Hause')
    expect(formatDifference(-60)).toBe('1 Std. früher als zu Hause')
    expect(formatDifference(270)).toBe('4:30 Std. später als zu Hause')
  })
})

describe('Notruf und Auto', () => {
  it('fasst gleiche Nummern zusammen', () => {
    expect(emergencyRows({ all: '112', police: '113', ambulance: '118', fire: '115' }).map((r) => r.number)).toEqual(['112', '113', '118', '115'])
    const jp = emergencyRows({ police: '110', ambulance: '119', fire: '119' })
    expect(jp).toEqual([
      { label: 'Polizei', number: '110', main: false },
      { label: 'Rettung, Feuerwehr', number: '119', main: false }
    ])
    expect(emergencyRows({ all: '999', other: '112' }).map((r) => r.label)).toEqual(['Notruf', 'auch'])
  })
  it('Tempo, Promille', () => {
    expect(speedRows(FACTS.AT).map((r) => r.value)).toEqual(['50 km/h', '100 km/h', '130 km/h'])
    expect(speedRows(FACTS.GB)[2].value).toBe('70 mph')
    expect(speedRows(FACTS.MT)[2].value).toBe('keine Autobahnen')
    expect(alcoholText(FACTS.IT)).toBe('0,5 ‰ · Fahranfänger 0,0 ‰')
    expect(alcoholText(FACTS.CZ)).toBe('0,0 ‰')
    expect(alcoholText(FACTS.US)).toBeNull()
  })
})

describe('Reise', () => {
  it('Zielländer vor Durchreise, ohne Deutschland und doppelte', () => {
    expect(sheetCountries({ countries: ['IT', 'DE'], transit: ['AT', 'IT', 'CH'] })).toEqual([
      { code: 'IT', transit: false },
      { code: 'AT', transit: true },
      { code: 'CH', transit: true }
    ])
    expect(sheetCountries(undefined)).toEqual([])
  })
  it('Kurzfassung', () => {
    expect(countrySummary('IT')).toBe('🇮🇹 Italien: Notruf 112')
    expect(countrySummary('GB')).toBe('🇬🇧 Vereinigtes Königreich: Notruf 999, Adapter Typ G, Linksverkehr')
    expect(countrySummary('CZ')).toContain('0,0 ‰')
    expect(sheetSummary([])).toContain('Zielland angeben')
  })
})
