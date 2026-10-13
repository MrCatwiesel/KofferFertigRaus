import { describe, expect, it } from 'vitest'
import { buildIcs, defaultAlarm, foldLine, groupOf, notBefore, shiftDate, sortReminders, type Reminder } from '../reminders'

const r = (over: Partial<Reminder>): Reminder => ({ id: 'x', tripId: 't1', date: '2026-11-20', title: 'Test', kind: 'termin', ...over })

describe('Termine', () => {
  it('Gruppen', () => {
    const today = '2026-11-10'
    expect(groupOf(r({ date: '2026-11-01', kind: 'pruefen' }), today)).toBe('ueberfaellig')
    expect(groupOf(r({ date: '2026-11-01' }), today)).toBe('vorbei')
    expect(groupOf(r({ date: '2026-11-08', endDate: '2026-11-12', kind: 'reise' }), today)).toBe('heute')
    expect(groupOf(r({ date: '2026-11-17' }), today)).toBe('woche')
    expect(groupOf(r({ date: '2026-11-18' }), today)).toBe('spaeter')
  })
  it('Datumshilfen und Sortierung', () => {
    expect(shiftDate('2026-03-01', -1)).toBe('2026-02-28')
    expect(notBefore('2026-01-01', '2026-02-01')).toBe('2026-02-01')
    expect(sortReminders([r({ id: 'b', time: '10:00' }), r({ id: 'a' }), r({ id: 'c', date: '2026-11-19' })]).map((x) => x.id)).toEqual(['c', 'a', 'b'])
  })
  it('Vorwarnung je Art', () => {
    expect(defaultAlarm(r({ kind: 'frist' }))).toBe(2880)
    expect(defaultAlarm(r({ time: '08:00' }))).toBe(120)
    expect(defaultAlarm(r({}))).toBe(360)
    expect(defaultAlarm(r({ alarmMinutes: 0 }))).toBe(0)
  })
})

describe('Kalenderdatei (iCalendar)', () => {
  const ics = buildIcs(
    [
      r({ id: 'acc:1:storno', kind: 'frist', date: '2026-11-12', title: 'Storno: Hotel Morgenzeit, Maria Alm; Zimmer 3', to: '/trip/t1/unterkuenfte/1' }),
      r({ id: 'leg:2', date: '2026-11-20', time: '07:30', endTime: '12:15', title: 'Auto: Sulzbach → Maria Alm', location: 'Sulzbach-Rosenberg' }),
      r({ id: 'trip:t1', kind: 'reise', date: '2026-11-20', endDate: '2026-11-26', title: 'Reise: Großglockner' })
    ],
    { name: 'Nix wie weg', appUrl: 'https://reise.example/', now: new Date('2026-10-13T10:00:00Z') }
  )
  const lines = ics.split('\r\n')
  it('Grundgerüst, CRLF, Abo-Intervall', () => {
    expect(lines[0]).toBe('BEGIN:VCALENDAR')
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true)
    expect(ics).toContain('REFRESH-INTERVAL;VALUE=DURATION:PT1H')
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3)
    expect(ics).toContain('DTSTAMP:20261013T100000Z')
  })
  it('ganztägig, mehrtägig, mit Uhrzeit', () => {
    expect(ics).toContain('DTSTART;VALUE=DATE:20261112\r\nDTEND;VALUE=DATE:20261113')
    expect(ics).toContain('DTSTART;VALUE=DATE:20261120\r\nDTEND;VALUE=DATE:20261127')
    expect(ics).toContain('DTSTART:20261120T073000\r\nDTEND:20261120T121500')
  })
  it('Sonderzeichen maskiert, Link zur App, Erinnerungen', () => {
    expect(ics.replace(/\r\n /g, '')).toContain('SUMMARY:Storno: Hotel Morgenzeit\\, Maria Alm\\; Zimmer 3')
    expect(ics.replace(/\r\n /g, '')).toContain('DESCRIPTION:https://reise.example/#/trip/t1/unterkuenfte/1')
    expect(ics).toContain('TRIGGER:-P2D')
    expect(ics).toContain('TRIGGER:-PT2H')
    expect(ics).toContain('TRIGGER:-PT6H')
    expect(ics).toContain('UID:acc:1:storno@nix-wie-weg')
  })
  it('lange Zeilen werden gefaltet (max. 75 Bytes, auch mit Umlauten)', () => {
    const long = foldLine(`SUMMARY:${'Großglockner-Hochalpenstraße '.repeat(6)}`)
    for (const l of long.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75)
    expect(long.replace(/\r\n /g, '')).toBe(`SUMMARY:${'Großglockner-Hochalpenstraße '.repeat(6)}`)
    expect(lines.every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true)
  })
})
