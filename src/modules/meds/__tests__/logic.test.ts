import { describe, expect, it } from 'vitest'
import {
  dailySchedule, emptyMedicationDraft, emptyVaccinationDraft, expiryStatus, normalizeTimes, sortMeds, stockStatus,
  summarizeMeds, unitsNeeded, vaccinationNeedsAction, validateMedication, validateVaccination,
  matchVaccination, mergeVaccineAdvice, vaccinationFromAdvice
} from '../logic'
import type { Medication, Vaccination } from '../types'

const med = (over: Partial<Medication>): Medication => ({
  ...emptyMedicationDraft({ name: 'X' }),
  id: Math.random().toString(36),
  tripId: 't1',
  createdAt: '',
  updatedAt: '',
  ...over
})
const vacc = (over: Partial<Vaccination>): Vaccination => ({
  ...emptyVaccinationDraft({ name: 'V' }),
  id: Math.random().toString(36),
  tripId: 't1',
  createdAt: '',
  updatedAt: '',
  ...over
})

describe('Mengen', () => {
  it('rechnet Stück für Reise plus Reserve', () => {
    // 1 Stück, 2× täglich, 10 Tage + 3 Reserve = 26
    expect(unitsNeeded(med({ unitsPerDose: 1, times: ['08:00', '20:00'] }), 10)).toBe(26)
    expect(unitsNeeded(med({ unitsPerDose: 0.5, times: ['08:00'] }), 7, 0)).toBe(4)
  })
  it('keine Berechnung bei Bedarfsmedikamenten oder fehlenden Angaben', () => {
    expect(unitsNeeded(med({ kind: 'bedarf' }), 10)).toBeNull()
    expect(unitsNeeded(med({ unitsPerDose: null }), 10)).toBeNull()
    expect(unitsNeeded(med({ times: [] }), 10)).toBeNull()
  })
})

describe('Vorrat genau', () => {
  it('meldet fehlende Stück', () => {
    // 1×täglich, 14 Tage + 3 = 17 Bedarf
    expect(stockStatus(med({ times: ['08:00'], stockUnits: 10 }), 14)).toEqual({ state: 'knapp', missing: 7 })
    expect(stockStatus(med({ times: ['08:00'], stockUnits: 30 }), 14)).toEqual({ state: 'ok', missing: 0 })
    expect(stockStatus(med({ times: ['08:00'], stockUnits: null }), 14).state).toBe('unbekannt')
  })
})

describe('Ablauf und Impfungen', () => {
  const today = new Date(2026, 9, 3)
  it('Ablaufdatum relativ zu heute und Reiseende', () => {
    expect(expiryStatus('2026-09-30', '2026-10-20', today)).toBe('abgelaufen')
    expect(expiryStatus('2026-10-15', '2026-10-20', today)).toBe('waehrend')
    expect(expiryStatus('2027-01-01', '2026-10-20', today)).toBe('ok')
    expect(expiryStatus('', '2026-10-20', today)).toBe('unbekannt')
  })
  it('Impfung braucht Aufmerksamkeit, wenn offen oder Schutz endet', () => {
    expect(vaccinationNeedsAction(vacc({ status: 'pruefen' }), '2026-10-20')).toBe(true)
    expect(vaccinationNeedsAction(vacc({ status: 'erledigt', validUntil: '2026-10-10' }), '2026-10-20')).toBe(true)
    expect(vaccinationNeedsAction(vacc({ status: 'erledigt', validUntil: '2030-01-01' }), '2026-10-20')).toBe(false)
    expect(vaccinationNeedsAction(vacc({ status: 'erledigt' }), '2026-10-20')).toBe(false)
  })
})

describe('Einnahmeplan', () => {
  const list = [
    med({ name: 'B-Mittel', times: ['20:00', '08:00'], person: 'Anna' }),
    med({ name: 'A-Mittel', times: ['08:00'] }),
    med({ name: 'Pflaster', kind: 'bedarf', times: [] }),
    med({ name: 'C-Mittel', times: ['12:00'], person: 'Ben' })
  ]
  it('sortiert nach Uhrzeit, nur Dauermedikation', () => {
    expect(dailySchedule(list).map((e) => `${e.time} ${e.medication.name}`)).toEqual([
      '08:00 A-Mittel', '08:00 B-Mittel', '12:00 C-Mittel', '20:00 B-Mittel'
    ])
  })
  it('filtert nach Person, Gemeinsames bleibt', () => {
    expect(dailySchedule(list, 'Anna').map((e) => e.medication.name)).toEqual(['A-Mittel', 'B-Mittel', 'B-Mittel'])
  })
  it('normalisiert Zeiten', () => {
    expect(normalizeTimes(['20:00', 'x', '08:00', '20:00', ''])).toEqual(['08:00', '20:00'])
  })
})

describe('Übersicht und Prüfung', () => {
  it('zählt Probleme', () => {
    const today = new Date(2026, 9, 3)
    const s = summarizeMeds(
      [med({ times: ['08:00'], stockUnits: 1 }), med({ kind: 'bedarf', expiryDate: '2026-09-01', packed: true })],
      [vacc({ status: 'geplant' })],
      '2026-10-10', '2026-10-20', today
    )
    expect(s).toEqual({ count: 2, short: 1, expiring: 1, vaccinationsOpen: 1, unpacked: 1 })
  })
  it('sortiert Notfall vor Dauer vor Bedarf', () => {
    const l = sortMeds([med({ name: 'b', kind: 'bedarf' }), med({ name: 'd', kind: 'dauer' }), med({ name: 'n', kind: 'notfall' })])
    expect(l.map((m) => m.kind)).toEqual(['notfall', 'dauer', 'bedarf'])
  })
  it('prüft Pflichtangaben', () => {
    expect(validateMedication(emptyMedicationDraft()).name).toBeDefined()
    expect(validateMedication(emptyMedicationDraft({ name: 'X', times: [] })).times).toBeDefined()
    expect(validateMedication(emptyMedicationDraft({ name: 'X', kind: 'bedarf', times: [] }))).toEqual({})
    expect(validateVaccination(emptyVaccinationDraft()).name).toBeDefined()
  })
})

describe('Impfungen aus den Reisehinweisen', () => {
  const adv = mergeVaccineAdvice([
    { countryName: 'Österreich', vaccines: [{ name: 'FSME', required: false }, { name: 'Tetanus', required: false }] },
    { countryName: 'Ghana', vaccines: [{ name: 'Tetanus', required: false }, { name: 'Gelbfieber', required: true }] }
  ])
  it('fasst Länder zusammen, Pflicht zuerst', () => {
    expect(adv.map((a) => a.name)).toEqual(['Gelbfieber', 'FSME', 'Tetanus'])
    expect(adv.find((a) => a.name === 'Tetanus')!.countries).toEqual(['Österreich', 'Ghana'])
  })
  it('erkennt eingetragene Impfungen auch bei anderer Schreibweise', () => {
    const list = [{ name: 'FSME-Impfung' }, { name: 'Tetanus/Diphtherie' }, { name: 'Keuchhusten' }, { name: 'Hepatitis A+B' }]
    expect(matchVaccination({ name: 'FSME' }, list)?.name).toBe('FSME-Impfung')
    expect(matchVaccination({ name: 'Tetanus' }, list)?.name).toBe('Tetanus/Diphtherie')
    expect(matchVaccination({ name: 'Keuchhusten (Pertussis)' }, list)?.name).toBe('Keuchhusten')
    expect(matchVaccination({ name: 'Hepatitis A' }, list)?.name).toBe('Hepatitis A+B')
    expect(matchVaccination({ name: 'Hepatitis B' }, list)).toBeUndefined()
    expect(matchVaccination({ name: 'Gelbfieber' }, list)).toBeUndefined()
  })
  it('neue Impfung mit Hinweis', () => {
    expect(vaccinationFromAdvice(adv[0])).toMatchObject({ name: 'Gelbfieber', status: 'pruefen', notes: 'Pflicht bei Einreise (Ghana) – laut Auswärtigem Amt.' })
  })
})
