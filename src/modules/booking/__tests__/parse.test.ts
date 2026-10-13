import { describe, expect, it } from 'vitest'
import { findBookingRef, findDates, findPrice, findTimes, parseAmount, parseBooking, parseIcs } from '../parse'

describe('Bausteine', () => {
  it('Datumsangaben', () => {
    expect(findDates('Fr., 4. Okt. 2026 bis So., 9. Oktober 2026').map((d) => d.value)).toEqual(['2026-10-04', '2026-10-09'])
    expect(findDates('Sunday, October 4, 2026').map((d) => d.value)).toEqual(['2026-10-04'])
    expect(findDates('04.10.2026 und 2026-10-09').map((d) => d.value)).toEqual(['2026-10-04', '2026-10-09'])
    expect(findDates('am 4. März', '2026-02-20').map((d) => d.value)).toEqual(['2026-03-04'])
    expect(findDates('31.02.2026')).toEqual([])
  })
  it('Uhrzeiten, aber kein Datum als Uhrzeit', () => {
    expect(findTimes('ab 8:15 Uhr, an 10.30 Uhr, 04.10. und 9:05 PM').map((t) => t.value)).toEqual(['08:15', '10:30', '21:05'])
  })
  it('Beträge und Gesamtpreis', () => {
    expect(parseAmount('1.234,50')).toBe(1234.5)
    expect(parseAmount('1,234.50')).toBe(1234.5)
    expect(parseAmount('980')).toBe(980)
    expect(findPrice('Zimmer 120,00 € pro Nacht\nGesamtpreis: € 600,00\nCity Tax 12,00 €')).toEqual({ amount: 600, currency: 'EUR' })
    expect(findPrice('Total CHF 1’245.00')).toEqual({ amount: 1245, currency: 'CHF' })
  })
  it('Buchungsnummer', () => {
    expect(findBookingRef('Buchungsnummer: 4711.123.456')).toBe('4711.123.456')
    expect(findBookingRef('Confirmation code HMABC12345')).toBe('HMABC12345')
    expect(findBookingRef('Buchungscode (PNR): X7YZQ2')).toBe('X7YZQ2')
  })
})

const HOTEL = `Buchungsbestätigung
Hotel Morgenzeit
Sinnlehen 10
5761 Maria Alm
Österreich
Sehr geehrter Herr Muster,
vielen Dank für Ihre Buchung.
Buchungsnummer: MZ-2026-0815
Anreise: Sonntag, 04.10.2026 ab 15:00 Uhr
Abreise: Freitag, 09.10.2026 bis 10:00 Uhr
1 Doppelzimmer Bergblick, Halbpension, 5 Nächte
Gesamtpreis: 1.245,00 EUR
Kostenlose Stornierung bis 27.09.2026.`

const BOOKING_COM = `Ihre Buchung ist bestätigt!
Gasthof Alpenrose
Dorfstraße 3, 6105 Leutasch, Österreich
Check-in Fr., 12. Juni 2026 (ab 14:00)
Check-out So., 14. Juni 2026 (bis 11:00)
Buchungsnummer: 3412.556.701
PIN-Code: 1234
Preis € 286
Sie können kostenlos stornieren bis 10. Juni 2026 23:59 [CEST].
https://secure.booking.com/myreservations.html?bn=3412556701`

const AIRBNB = `Your reservation is confirmed
You're going to Lisbon!
Sunny apartment in Alfama
Check-in
Thu, Jul 9
3:00 PM
Checkout
Mon, Jul 13
11:00 AM
Confirmation code HMKX9Q2T4P
Total (EUR) €612.40
Free cancellation before Jul 2.`

describe('Unterkünfte', () => {
  it('Hotel-Bestätigung (deutsch)', () => {
    const g = parseBooking(HOTEL)
    expect(g.kind).toBe('unterkunft')
    expect(g.stay).toMatchObject({
      name: 'Hotel Morgenzeit', type: 'hotel', address: 'Sinnlehen 10, 5761 Maria Alm, Österreich',
      checkIn: '2026-10-04', checkOut: '2026-10-09', price: 1245, currency: 'EUR', bookingRef: 'MZ-2026-0815', cancelUntil: '2026-09-27'
    })
    expect(g.found).toEqual(expect.arrayContaining(['Name', 'Anreise', 'Abreise', 'Preis', 'Buchungsnummer', 'Stornofrist', 'Adresse']))
  })
  it('Booking.com-Stil', () => {
    const g = parseBooking(BOOKING_COM)
    expect(g.stay).toMatchObject({ name: 'Gasthof Alpenrose', checkIn: '2026-06-12', checkOut: '2026-06-14', price: 286, bookingRef: '3412.556.701', cancelUntil: '2026-06-10' })
    expect(g.stay.address).toBe('Dorfstraße 3, 6105 Leutasch, Österreich')
    expect(g.stay.url).toContain('booking.com')
  })
  it('Airbnb (englisch, ohne Jahr)', () => {
    const g = parseBooking(AIRBNB, '2026-07-01')
    expect(g.kind).toBe('unterkunft')
    expect(g.stay).toMatchObject({ type: 'ferienwohnung', checkIn: '2026-07-09', checkOut: '2026-07-13', price: 612.4, bookingRef: 'HMKX9Q2T4P', cancelUntil: '2026-07-02' })
    expect(g.stay.name).toBe('Sunny apartment in Alfama')
  })
  it('Zeitraum „vom … bis …“', () => {
    const g = parseBooking('Ferienwohnung Seeblick\nIhr Aufenthalt vom 4. bis 9. Oktober 2026\nGesamt 540 €')
    expect(g.stay).toMatchObject({ name: 'Ferienwohnung Seeblick', type: 'ferienwohnung', checkIn: '2026-10-04', checkOut: '2026-10-09', price: 540 })
  })
})

const FLUG = `Ihre Flugbuchung – Buchungscode (PNR): X7YZQ2
Hinflug
Sa., 18. Juli 2026
LH 2110 München (MUC) 07:05 – Palma de Mallorca (PMI) 09:15
Rückflug
Sa., 25. Juli 2026
LH 2111 Palma de Mallorca (PMI) 10:05 – München (MUC) 12:20
Gesamtpreis 412,58 EUR`

const BAHN = `Ihre Fahrkarte – Auftragsnummer 1234567890
Flexpreis, 2. Klasse
Hinfahrt am 04.10.2026
Halt Datum Zeit Gleis Produkte
ab Nürnberg Hbf 04.10. 08:12 7 ICE 1007
an München Hbf 04.10. 09:15 18
Summe 49,90 €`

describe('Reise-Etappen', () => {
  it('Flug mit Hin- und Rückflug', () => {
    const g = parseBooking(FLUG)
    expect(g.kind).toBe('reise')
    expect(g.legs).toEqual([
      { mode: 'flug', from: 'München (MUC)', to: 'Palma de Mallorca (PMI)', date: '2026-07-18', departTime: '07:05', arriveTime: '09:15', number: 'LH 2110' },
      { mode: 'flug', from: 'Palma de Mallorca (PMI)', to: 'München (MUC)', date: '2026-07-25', departTime: '10:05', arriveTime: '12:20', number: 'LH 2111' }
    ])
    expect(g.bookingRef).toBe('X7YZQ2')
    expect(g.price).toBe(412.58)
  })
  it('Bahn (DB-Fahrkarte)', () => {
    const g = parseBooking(BAHN)
    expect(g.kind).toBe('reise')
    expect(g.legs[0]).toMatchObject({ mode: 'bahn', from: 'Nürnberg Hbf', to: 'München Hbf', date: '2026-10-04', departTime: '08:12', arriveTime: '09:15', number: 'ICE 1007' })
    expect(g.price).toBe(49.9)
  })
  it('Unbekanntes bleibt unbekannt', () => {
    expect(parseBooking('Hallo, wie geht es dir?').kind).toBe('unbekannt')
  })
})

describe('Kalenderdateien', () => {
  const ics = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR`
  it('Hotel als ganztägiger Mehrtagestermin', () => {
    const g = parseBooking(ics('BEGIN:VEVENT\r\nSUMMARY:Aufenthalt im Hotel Morgenzeit\r\nLOCATION:Sinnlehen 10\\, 5761 Maria Alm\r\nDTSTART;VALUE=DATE:20261004\r\nDTEND;VALUE=DATE:20261009\r\nDESCRIPTION:Buchungsnummer: MZ-2026-0815\\nGesamtpreis 1.245\r\n ,00 EUR\r\nEND:VEVENT'))
    expect(g.kind).toBe('unterkunft')
    expect(g.stay).toMatchObject({ name: 'Hotel Morgenzeit', address: 'Sinnlehen 10, 5761 Maria Alm', checkIn: '2026-10-04', checkOut: '2026-10-09', bookingRef: 'MZ-2026-0815', price: 1245 })
  })
  it('Flug als Termin mit Uhrzeit', () => {
    const ev = parseIcs(ics('BEGIN:VEVENT\nSUMMARY:Flug LH 2110 München → Palma\nDTSTART:20260718T070500\nDTEND:20260718T091500\nEND:VEVENT'))
    expect(ev[0]).toMatchObject({ start: '2026-07-18', startTime: '07:05', endTime: '09:15' })
    const g = parseBooking(ics('BEGIN:VEVENT\nSUMMARY:Flug LH 2110 München → Palma\nDTSTART:20260718T070500\nDTEND:20260718T091500\nEND:VEVENT'))
    expect(g.legs[0]).toMatchObject({ mode: 'flug', from: 'LH 2110 München', to: 'Palma', departTime: '07:05', number: 'LH 2110' })
  })
})

import { directionOf, legDrafts, outsideTrip, stayDraft } from '../logic'

describe('Übernahme in die Reise', () => {
  const trip = { startDate: '2026-07-18', endDate: '2026-07-25', currency: 'EUR' }
  it('Hin- und Rückflug richtig zugeordnet, Preis nur einmal', () => {
    const d = legDrafts(parseBooking(FLUG), trip, '')
    expect(d.map((x) => x.direction)).toEqual(['hin', 'rueck'])
    expect(d.map((x) => x.cost)).toEqual([412.58, null])
    expect(d[0].notes).toContain('Flug LH 2110')
    expect(d[0].bookingRef).toBe('X7YZQ2')
  })
  it('Unterkunft als „gebucht“', () => {
    expect(stayDraft(parseBooking(HOTEL).stay, 'x')).toMatchObject({ status: 'gebucht', name: 'Hotel Morgenzeit', notes: 'x' })
  })
  it('Daten außerhalb der Reise erkennen', () => {
    expect(outsideTrip(['2026-07-18', '2026-07-25'], trip)).toBe(false)
    expect(outsideTrip(['2026-10-04'], trip)).toBe(true)
    expect(directionOf('', trip)).toBe('hin')
  })
})
