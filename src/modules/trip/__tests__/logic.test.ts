import { describe, expect, it } from 'vitest'
import { budgetPerPersonDay, cleanParticipants, daysUntil, emptyTripDraft, participantsOf, tripDays, tripPhase, validateTrip, tripStatusText, defaultTripTab } from '../logic'

describe('tripDays', () => {
  it('zählt An- und Abreisetag mit', () => {
    expect(tripDays('2026-07-01', '2026-07-14')).toBe(14)
    expect(tripDays('2026-07-01', '2026-07-01')).toBe(1)
  })
  it('funktioniert über die Zeitumstellung hinweg', () => {
    expect(tripDays('2026-10-20', '2026-10-30')).toBe(11)
  })
})

describe('daysUntil / tripPhase', () => {
  const today = new Date(2026, 9, 3) // 3. Oktober 2026
  it('berechnet die Tage bis zum Start', () => {
    expect(daysUntil('2026-10-10', today)).toBe(7)
  })
  it('erkennt die Phase', () => {
    expect(tripPhase('2026-10-10', '2026-10-20', today)).toBe('planung')
    expect(tripPhase('2026-10-01', '2026-10-05', today)).toBe('unterwegs')
    expect(tripPhase('2026-09-01', '2026-09-05', today)).toBe('vorbei')
  })
})

describe('budgetPerPersonDay', () => {
  it('teilt durch Personen und Tage', () => {
    expect(budgetPerPersonDay({ budget: 1400, travelers: 2, startDate: '2026-07-01', endDate: '2026-07-07' })).toBe(100)
  })
  it('liefert null ohne Budget', () => {
    expect(budgetPerPersonDay({ budget: null, travelers: 2, startDate: '2026-07-01', endDate: '2026-07-07' })).toBeNull()
  })
})

describe('validateTrip', () => {
  it('meldet Pflichtfelder', () => {
    const errors = validateTrip(emptyTripDraft())
    expect(Object.keys(errors).sort()).toEqual(['destination', 'endDate', 'startDate', 'title'])
  })
  it('erkennt Ende vor Start', () => {
    const errors = validateTrip({ ...emptyTripDraft(), title: 'X', destination: 'Y', startDate: '2026-07-10', endDate: '2026-07-01' })
    expect(errors.endDate).toBeDefined()
  })
})

describe('Teilnehmer', () => {
  it('bereinigt Namen', () => {
    expect(cleanParticipants([' Ich ', '', 'Anna', 'anna', 'Ich'])).toEqual(['Ich', 'Anna'])
  })
  it('ältere Reisen ohne Feld liefern leere Liste', () => {
    expect(participantsOf({} as { participants: string[] })).toEqual([])
    expect(participantsOf(undefined)).toEqual([])
  })
  it('meldet doppelte Namen', () => {
    const e = validateTrip({ ...emptyTripDraft(), title: 'X', destination: 'Y', startDate: '2026-07-01', endDate: '2026-07-02', participants: ['Anna', 'anna'] })
    expect(e.participants).toBeDefined()
  })
})

describe('Stand der Reise und passender Bereich', () => {
  const day = (iso: string) => new Date(`${iso}T12:00:00`)
  it('Text für den Kopf', () => {
    expect(tripStatusText('2026-11-20', '2026-11-26', day('2026-10-13'))).toBe('noch 38 Tage')
    expect(tripStatusText('2026-10-14', '2026-10-20', day('2026-10-13'))).toBe('morgen geht es los')
    expect(tripStatusText('2026-10-13', '2026-10-20', day('2026-10-13'))).toBe('heute geht es los · 8 Tage')
    expect(tripStatusText('2026-10-11', '2026-10-18', day('2026-10-13'))).toBe('Tag 3 von 8')
    expect(tripStatusText('2026-10-01', '2026-10-12', day('2026-10-13'))).toBe('gestern zurückgekommen')
    expect(tripStatusText('2026-07-01', '2026-07-10', day('2026-10-13'))).toBe('vor 3 Monaten')
    expect(tripStatusText('2025-05-01', '2025-05-04', day('2026-10-13'))).toBe('vor einem Jahr')
  })
  it('Bereich nach Datum, Archiv → Teilen & Archiv', () => {
    expect(defaultTripTab({ startDate: '2026-11-20', endDate: '2026-11-26' }, day('2026-10-13'))).toBe('planung')
    expect(defaultTripTab({ startDate: '2026-10-11', endDate: '2026-10-18' }, day('2026-10-13'))).toBe('unterwegs')
    expect(defaultTripTab({ startDate: '2026-07-01', endDate: '2026-07-10' }, day('2026-10-13'))).toBe('danach')
    expect(defaultTripTab({ startDate: '2026-07-01', endDate: '2026-07-10', archived: true }, day('2026-10-13'))).toBe('teilen')
  })
})
