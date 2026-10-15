import { describe, expect, it } from 'vitest'
import { accommodationReminders } from '@/modules/accommodation/reminders'
import { travelReminders } from '@/modules/travel/reminders'
import { activityReminders } from '@/modules/activity/reminders'
import { documentReminders } from '@/modules/documents/reminders'
import { packingReminders } from '@/modules/packing/reminders'
import { medsReminders } from '@/modules/meds/reminders'
import { aboUrls, icsHash } from '../calendar'

const trip = { id: 't1', title: 'Großglockner', destination: 'Fusch', startDate: '2026-11-20', endDate: '2026-11-26' }
const today = '2026-10-13'
const now = new Date('2026-10-13T10:00:00')

describe('Termine aus den Bereichen', () => {
  it('Unterkunft: Stornofrist, Aufenthalt, offene Anfrage', () => {
    const base = { id: 'a1', tripId: 't1', name: 'Hotel', type: 'hotel', address: 'Fusch 1', url: '', checkIn: '2026-11-20', checkOut: '2026-11-23', price: null, currency: 'EUR', bookingRef: 'B-1', notes: '', createdAt: '', updatedAt: '' } as const
    const list = accommodationReminders([{ ...base, status: 'gebucht', cancelUntil: '2026-11-10' }, { ...base, id: 'a2', name: 'Pension', status: 'angefragt', cancelUntil: '' }], trip, today)
    expect(list.map((r) => r.id)).toEqual(['acc:a1:storno', 'acc:a1:checkin', 'acc:a2:anfrage'])
    expect(list[0]).toMatchObject({ kind: 'frist', date: '2026-11-10' })
    expect(list[1]).toMatchObject({ endDate: '2026-11-23', location: 'Fusch 1' })
  })
  it('Flug: Abflug mit Uhrzeit (Online-Check-in kommt aus den Abreise-Checklisten)', () => {
    const leg = { id: 'l1', tripId: 't1', direction: 'hin', position: 0, mode: 'flug', from: 'NUE', to: 'PMI', date: '2026-11-20', departTime: '06:40', arriveTime: '09:05', distanceKm: null, cost: null, currency: 'EUR', consumption: null, fuelPrice: null, tolls: null, bookingRef: 'XY12', url: '', notes: '', createdAt: '', updatedAt: '' } as const
    const list = travelReminders([leg], trip)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ time: '06:40', endTime: '09:05', title: 'Flug: NUE → PMI', alarmMinutes: 180 })
  })
  it('Unternehmung mit Buchung: Aufgabe eine Woche vorher', () => {
    const a = { id: 'x1', tripId: 't1', title: 'Gletscherführung', category: 'natur', place: '', url: '', setting: 'aussen', priority: 1, durationHours: null, pricePerPerson: null, currency: 'EUR', openingHours: '', bookingRequired: true, status: 'geplant', plannedDate: '2026-11-22', notes: '', createdAt: '', updatedAt: '' } as const
    const list = activityReminders([a], trip, today)
    expect(list.map((r) => [r.kind, r.date])).toEqual([['termin', '2026-11-22'], ['pruefen', '2026-11-15']])
  })
  it('Reisepass läuft während der Reise ab → verlängern, 6 Wochen vorher (nicht in der Vergangenheit)', () => {
    const d = { id: 'd1', tripId: 't1', type: 'reisepass', title: '', person: 'Birgit', number: '', validUntil: '2026-11-24', status: 'vorhanden', hasCopy: false, packed: false, notes: '', createdAt: '', updatedAt: '' } as const
    const [x] = documentReminders([d], trip, today, now)
    expect(x).toMatchObject({ kind: 'pruefen', date: '2026-10-13' })
    expect(x.title).toBe('Verlängern: Reisepass (Birgit) – gültig bis 24.11.2026')
    expect(documentReminders([d], { ...trip, endDate: '2026-01-01' }, today, now)).toEqual([])
  })
  it('Impftermin und Packliste', () => {
    const v = { id: 'v1', tripId: 't1', name: 'FSME', person: '', date: '2026-10-30', validUntil: '', status: 'geplant', notes: '', createdAt: '', updatedAt: '' } as const
    expect(medsReminders([], [v], trip, today, now)[0]).toMatchObject({ kind: 'termin', date: '2026-10-30', title: 'Impftermin: FSME' })
    const items = [{ packed: true }, { packed: false }, { packed: false }] as never
    expect(packingReminders(items, trip, today)[0]).toMatchObject({ date: '2026-11-18', title: 'Packen: noch 2 Sachen offen' })
  })
})

describe('Kalender-Abo', () => {
  it('Adressen und Prüfsumme ohne Zeitstempel', () => {
    expect(aboUrls('https://reise.example/', 'abc')).toEqual({ https: 'https://reise.example/api/kalender/abc.ics', webcal: 'webcal://reise.example/api/kalender/abc.ics' })
    expect(icsHash('A\r\nDTSTAMP:1\r\nB')).toBe(icsHash('A\r\nDTSTAMP:2\r\nB'))
    expect(icsHash('A')).not.toBe(icsHash('B'))
  })
})
