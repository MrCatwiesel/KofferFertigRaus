import { describe, expect, it } from 'vitest'
import { buildIcs, defaultAlarm, foldLine, groupOf, notBefore, pushItems, shiftDate, sortReminders, whenLabel, type Reminder } from '../reminders'

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
    { name: 'KofferFertigRaus', appUrl: 'https://reise.example/', now: new Date('2026-10-13T10:00:00Z') }
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
    expect(ics).toContain('UID:acc:1:storno@koffer-fertig-raus')
  })
  it('lange Zeilen werden gefaltet (max. 75 Bytes, auch mit Umlauten)', () => {
    const long = foldLine(`SUMMARY:${'Großglockner-Hochalpenstraße '.repeat(6)}`)
    for (const l of long.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75)
    expect(long.replace(/\r\n /g, '')).toBe(`SUMMARY:${'Großglockner-Hochalpenstraße '.repeat(6)}`)
    expect(lines.every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true)
  })
})

describe('Zeitplan für Push-Benachrichtigungen', () => {
  // Ortszeit des Testrechners – so wie die App auf dem Gerät rechnet
  const now = new Date(2026, 9, 20, 9, 0)
  const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi).toISOString()
  const list: Reminder[] = [
    { id: 'acc:1:storno', tripId: 't', date: '2026-10-23', kind: 'frist', title: 'Stornofrist Hütte', detail: 'Kostenlos bis 18 Uhr\nReise: Dolomiten', to: '/trip/t/unterkunft' },
    { id: 'leg:1', tripId: 't', date: '2026-10-20', time: '14:30', kind: 'termin', title: 'Zug nach Bozen', location: 'München Hbf' },
    { id: 'leg:0', tripId: 't', date: '2026-10-20', time: '10:00', kind: 'termin', title: 'Schon vorbei (Vorwarnung 8 Uhr)' },
    { id: 'trip:t', tripId: 't', date: '2026-10-25', endDate: '2026-10-30', kind: 'reise', title: 'Reise: Dolomiten' },
    { id: 'ohne', tripId: 't', date: '2026-10-21', kind: 'termin', title: 'Ohne Erinnerung', alarmMinutes: -1 },
    { id: 'weit', tripId: 't', date: '2027-03-01', kind: 'termin', title: 'Zu weit weg' }
  ]

  it('Zeitpunkt = Beginn minus Vorwarnung, nur Kommendes', () => {
    const items = pushItems(list, now)
    expect(items.map((i) => i.id)).toEqual(['leg:1', 'acc:1:storno', 'trip:t'])
    expect(items[0]).toEqual({ id: 'leg:1', at: at(2026, 10, 20, 12, 30), title: 'Zug nach Bozen', body: 'heute 14:30 Uhr · München Hbf', url: '' })
    // Frist: zwei Tage vorher um 0 Uhr
    expect(items[1]).toEqual({ id: 'acc:1:storno', at: at(2026, 10, 21), title: 'Stornofrist Hütte', body: 'übermorgen · Kostenlos bis 18 Uhr · Reise: Dolomiten', url: '#/trip/t/unterkunft' })
    // Reisebeginn: Vorabend 18 Uhr
    expect(items[2].at).toBe(at(2026, 10, 24, 18))
    expect(items[2].body).toBe('morgen')
  })

  it('Tage über den Monatswechsel', () => {
    const r: Reminder = { id: 'x', tripId: 't', date: '2026-11-02', kind: 'termin', title: 'X' }
    expect(whenLabel(r, new Date(2026, 9, 31, 18))).toBe('übermorgen')
    expect(whenLabel(r, new Date(2026, 9, 29, 18))).toBe('in 4 Tagen (Mo., 02.11.)')
    expect(whenLabel({ ...r, time: '07:15' }, new Date(2026, 10, 2, 5))).toBe('heute 07:15 Uhr')
  })
})
