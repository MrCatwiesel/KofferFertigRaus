import { describe, expect, it } from 'vitest'
import { bytesToText, decodeHeader, emailToText } from '../extract'
import { itemsToLines } from '../pdf'

const EML = [
  'From: "Hotel Morgenzeit" <info@hotel.example>',
  'Subject: =?ISO-8859-1?Q?Buchungsbest=E4tigung_Hotel_Morgenzeit?=',
  'MIME-Version: 1.0',
  'Content-Type: multipart/mixed; boundary="AAA"',
  '',
  '--AAA',
  'Content-Type: multipart/alternative; boundary="BBB"',
  '',
  '--BBB',
  'Content-Type: text/plain; charset=ISO-8859-1',
  'Content-Transfer-Encoding: quoted-printable',
  '',
  'Anreise: 04.10.2026=0AAbreise: 09.10.2026=0AGesamtpreis: 1.245,00 =80 f=FCr 5 N=E4chte',
  '--BBB',
  'Content-Type: text/html; charset=utf-8',
  'Content-Transfer-Encoding: base64',
  '',
  Buffer.from('<p>Anreise <b>04.10.2026</b></p>').toString('base64'),
  '--BBB--',
  '--AAA',
  'Content-Type: text/calendar; charset=utf-8',
  '',
  'BEGIN:VCALENDAR',
  'END:VCALENDAR',
  '--AAA--'
].join('\r\n')

describe('Dateien lesen', () => {
  it('E-Mail: Betreff, Text-Teil (quoted-printable, ISO-8859-1), Kalender-Anhang', () => {
    const t = emailToText(EML)
    expect(t).toContain('Buchungsbestätigung Hotel Morgenzeit')
    expect(t).toContain('Gesamtpreis: 1.245,00')
    expect(t).toContain('für 5 Nächte')
    expect(t).toContain('BEGIN:VCALENDAR')
  })
  it('E-Mail nur mit HTML', () => {
    const eml = ['Subject: Test', 'Content-Type: text/html; charset=utf-8', '', '<html><body><h1>Gasthof Alpenrose</h1><p>Check-in: 12.06.2026</p><p>Weitere Infos zu Ihrem Aufenthalt folgen in Kürze.</p></body></html>'].join('\n')
    expect(emailToText(eml)).toContain('Gasthof Alpenrose\nCheck-in: 12.06.2026')
  })
  it('Kopfzeilen und Zeichensätze', () => {
    expect(decodeHeader('=?utf-8?B?w5ZzdGVycmVpY2g=?=')).toBe('Österreich')
    expect(bytesToText(Uint8Array.from([0x47, 0x72, 0x6f, 0xdf]))).toBe('Groß')
  })
  it('PDF-Textstücke zu Zeilen', () => {
    const it = (str: string, x: number, y: number) => ({ str, transform: [1, 0, 0, 1, x, y] })
    expect(itemsToLines([it('Abreise:', 50, 700), it('Anreise:', 50, 720), it('04.10.2026', 120, 721), it('09.10.2026', 120, 699)])).toEqual(['Anreise: 04.10.2026', 'Abreise: 09.10.2026'])
  })
})
