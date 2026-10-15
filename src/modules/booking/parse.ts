import { t, tn } from '@/i18n'
/**
 * Buchungsbestätigungen verstehen – ohne Internet, nur aus dem Text (eingefügt, PDF, E-Mail oder Kalenderdatei).
 *
 * Erkennt Unterkünfte (Hotel, Ferienwohnung, Booking.com/Airbnb/HRS-Stil) und Reise-Etappen (Flug, Bahn, Bus, Fähre)
 * auf Deutsch und Englisch. Das Ergebnis ist ein Vorschlag – die Ansicht zeigt ihn zum Prüfen und Ändern an.
 * Reine Logik ohne DOM (testbar).
 */

export type BookingKind = 'unterkunft' | 'reise' | 'unbekannt'
export type LegMode = 'flug' | 'bahn' | 'bus' | 'faehre' | 'auto' | 'sonstiges'

export interface StayGuess {
  name: string
  type: 'hotel' | 'ferienwohnung' | 'camping' | 'hostel' | 'privat' | 'sonstiges'
  address: string
  checkIn: string
  checkOut: string
  price: number | null
  currency: string
  bookingRef: string
  cancelUntil: string
  url: string
}

export interface LegGuess {
  mode: LegMode
  from: string
  to: string
  date: string
  departTime: string
  arriveTime: string
  /** z. B. Flugnummer „LH 2110“ oder Zug „ICE 1007“ */
  number: string
}

export interface BookingGuess {
  kind: BookingKind
  stay: StayGuess
  legs: LegGuess[]
  price: number | null
  currency: string
  bookingRef: string
  /** Was erkannt wurde (für die Anzeige „erkannt: …“) */
  found: string[]
}

// ---------------------------------------------------------------- Text

/** Leerzeichen vereinheitlichen, Zeilen erhalten */
export function normalizeText(s: string): string {
  return s
    .replace(/\r\n?/g, '\n')
    .replace(/[   \t]/g, ' ')
    .replace(/[​‎‏﻿]/g, '')
    .replace(/[ ]{2,}/g, ' ')
    .split('\n')
    .map((l) => l.trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// ---------------------------------------------------------------- Datum, Uhrzeit, Geld

const MONTHS: [RegExp, number][] = [
  [/^jan/, 1], [/^feb/, 2], [/^(mär|mae|mar)/, 3], [/^apr/, 4], [/^(mai|may)/, 5], [/^jun/, 6],
  [/^jul/, 7], [/^aug/, 8], [/^sep/, 9], [/^(okt|oct)/, 10], [/^nov/, 11], [/^(dez|dec)/, 12]
]
const MONTH_WORD = '(?:jan(?:uar|uary)?|feb(?:ruar|ruary)?|m(?:ä|ae)rz|mar(?:ch)?|apr(?:il)?|mai|may|jun(?:i|e)?|jul(?:i|y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|okt(?:ober)?|oct(?:ober)?|nov(?:ember)?|dez(?:ember)?|dec(?:ember)?)\\.?'

function monthOf(word: string): number {
  const w = word.toLowerCase()
  return MONTHS.find(([re]) => re.test(w))?.[1] ?? 0
}

const pad = (n: number) => String(n).padStart(2, '0')
function iso(y: number, m: number, d: number): string {
  if (y < 100) y += 2000
  if (m < 1 || m > 12 || d < 1 || d > 31) return ''
  const t = new Date(Date.UTC(y, m - 1, d))
  return t.getUTCMonth() === m - 1 ? `${y}-${pad(m)}-${pad(d)}` : ''
}

/** Jahr ergänzen, wenn es fehlt: das zum Bezugsdatum nächstliegende */
function withYear(m: number, d: number, ref: string): string {
  const y = Number(ref.slice(0, 4)) || new Date().getFullYear()
  const cands = [y - 1, y, y + 1].map((yy) => iso(yy, m, d)).filter(Boolean)
  const r = Date.parse(ref || new Date().toISOString().slice(0, 10))
  return cands.sort((a, b) => Math.abs(Date.parse(a) - r) - Math.abs(Date.parse(b) - r))[0] ?? ''
}

export interface Found<T> {
  value: T
  index: number
  end: number
}

/** Alle Datumsangaben im Text (deutsch und englisch, mit oder ohne Jahr) */
export function findDates(text: string, ref = ''): Found<string>[] {
  const out: Found<string>[] = []
  const add = (value: string, m: RegExpExecArray) => {
    if (value && !out.some((o) => m.index < o.end && m.index + m[0].length > o.index)) out.push({ value, index: m.index, end: m.index + m[0].length })
  }
  const res: [RegExp, (m: RegExpExecArray) => string][] = [
    // 2026-10-04
    [/\b(20\d\d)-(\d\d)-(\d\d)\b/g, (m) => iso(+m[1], +m[2], +m[3])],
    // 04.10.2026, 4.10.26, 04/10/2026
    [/\b(\d{1,2})[./](\d{1,2})[./](20\d\d|\d\d)\b/g, (m) => iso(+m[3], +m[2], +m[1])],
    // 4. Oktober 2026, 4 Oct 2026, 4. Okt.
    [new RegExp(`\\b(\\d{1,2})\\.?\\s*(${MONTH_WORD})(?:\\s*,?\\s*(20\\d\\d))?`, 'gi'), (m) => (m[3] ? iso(+m[3], monthOf(m[2]), +m[1]) : withYear(monthOf(m[2]), +m[1], ref))],
    // October 4, 2026 / Oct 4
    [new RegExp(`\\b(${MONTH_WORD})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s*,?\\s*(20\\d\\d))?`, 'gi'), (m) => (m[3] ? iso(+m[3], monthOf(m[1]), +m[2]) : withYear(monthOf(m[1]), +m[2], ref))],
    // 04.10. (ohne Jahr)
    [/\b(\d{1,2})\.(\d{1,2})\.(?!\d)/g, (m) => withYear(+m[2], +m[1], ref)]
  ]
  for (const [re, fn] of res) {
    let m: RegExpExecArray | null
    while ((m = re.exec(text))) add(fn(m), m)
  }
  return out.sort((a, b) => a.index - b.index)
}

/** Uhrzeiten „08:15“, „8.15 Uhr“, „8:15 AM“ */
export function findTimes(text: string): Found<string>[] {
  const out: Found<string>[] = []
  const re = /\b([01]?\d|2[0-3])[:.]([0-5]\d)(?:\s*(Uhr|h\b|[ap]\.?m\.?))?/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    // „04.10“ ist ein Datum, keine Uhrzeit – nur mit Doppelpunkt, „Uhr“ oder am/pm als Uhrzeit nehmen
    if (m[0].includes('.') && !m[3]) continue
    let h = +m[1]
    const ampm = m[3]?.toLowerCase().replace(/\./g, '')
    if (ampm === 'pm' && h < 12) h += 12
    if (ampm === 'am' && h === 12) h = 0
    out.push({ value: `${pad(h)}:${m[2]}`, index: m.index, end: m.index + m[0].length })
  }
  return out
}

const CURRENCY_SIGNS: Record<string, string> = { '€': 'EUR', $: 'USD', '£': 'GBP', 'CHF': 'CHF', 'Fr.': 'CHF' }

/** Betrag „1.234,50“ oder „1,234.50“ oder „980“ → Zahl */
export function parseAmount(s: string): number | null {
  const t = s.replace(/\s/g, '').replace(/[’']/g, '')
  if (!/\d/.test(t)) return null
  let n: string
  if (/,\d{1,2}$/.test(t)) n = t.replace(/\./g, '').replace(',', '.')
  else if (/\.\d{1,2}$/.test(t)) n = t.replace(/,/g, '')
  else n = t.replace(/[.,]/g, '')
  const v = Number(n)
  return Number.isFinite(v) ? v : null
}

const AMOUNT = String.raw`(\d{1,3}(?:[.,'’ ]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)`
const CUR = String.raw`(€|EUR|CHF|Fr\.|USD|\$|GBP|£|SEK|NOK|DKK|CZK|PLN|HUF|HRK|TRY|AED|THB|JPY)`

/** Gesamtpreis: bevorzugt nach „Gesamt/Total/Summe/Endpreis“, sonst der größte Betrag mit Währung */
export function findPrice(text: string): { amount: number; currency: string } | null {
  const both = new RegExp(`${CUR}\\s?${AMOUNT}|${AMOUNT}\\s?${CUR}`, 'gi')
  const all: { amount: number; currency: string; index: number }[] = []
  let m: RegExpExecArray | null
  while ((m = both.exec(text))) {
    const cur = (m[1] ?? m[4] ?? '').toUpperCase()
    const amount = parseAmount(m[2] ?? m[3] ?? '')
    if (amount === null || amount <= 0) continue
    all.push({ amount, currency: CURRENCY_SIGNS[m[1] ?? m[4]] ?? (cur === 'FR.' ? 'CHF' : cur), index: m.index })
  }
  if (!all.length) return null
  const keyRe = /(gesamt(?:preis|betrag|summe)?|endpreis|total(?:\s*price|\s*amount)?|summe|zu zahlen|amount (?:paid|due)|reisepreis|preis gesamt|betrag)/gi
  let best: (typeof all)[number] | null = null
  let k: RegExpExecArray | null
  while ((k = keyRe.exec(text))) {
    const after = all.find((a) => a.index >= k!.index && a.index - k!.index < 80)
    if (after && (!best || after.amount >= best.amount)) best = after
  }
  const r = best ?? [...all].sort((a, b) => b.amount - a.amount)[0]
  return { amount: r.amount, currency: r.currency }
}

/** Buchungsnummer nach den üblichen Bezeichnungen */
export function findBookingRef(text: string): string {
  const re = /(buchungs(?:nummer|nr\.?|code|referenz)|best(?:ä|ae)tigungs(?:nummer|nr\.?|code)|reservierungs(?:nummer|nr\.?|code)|auftragsnummer|vorgangsnummer|booking (?:number|reference|id|code)|confirmation (?:number|code)|reservation (?:number|code)|buchungsreferenz|pnr|ticket(?:nummer)?)\s*(?:\([^)\n]{1,12}\))?\s*(?:[:#]|nr\.?|no\.?)?\s*([A-Z0-9][A-Z0-9.\-/]{3,24}[A-Z0-9])/i
  const m = re.exec(text)
  return m ? m[2].replace(/\.$/, '') : ''
}

/** Datum direkt hinter einer Bezeichnung (z. B. „Anreise: Fr., 4. Okt. 2026“) */
function dateAfter(text: string, label: RegExp, ref: string, within = 90): Found<string> | null {
  const re = new RegExp(label.source, 'gi')
  const dates = findDates(text, ref)
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    const d = dates.find((x) => x.index >= m!.index + m![0].length - 1 && x.index - m!.index <= within)
    if (d) return d
  }
  return null
}

function timeAfter(text: string, from: number, within = 60): string {
  return findTimes(text).find((t) => t.index >= from && t.index - from <= within)?.value ?? ''
}

// ---------------------------------------------------------------- Unterkunft

const STAY_WORDS: [RegExp, StayGuess['type']][] = [
  [/camping|campingplatz|zeltplatz|glamping|stellplatz/i, 'camping'],
  [/hostel|jugendherberge/i, 'hostel'],
  [/ferienwohnung|ferienhaus|apartment|appartement|chalet|holiday home|wohnung|bungalow|airbnb/i, 'ferienwohnung'],
  [/hotel|gasthof|gasthaus|pension|resort|inn\b|lodge|gästehaus|landhaus|hof\b|b&b|bed and breakfast|garni/i, 'hotel']
]

export function stayType(s: string): StayGuess['type'] {
  return STAY_WORDS.find(([re]) => re.test(s))?.[1] ?? 'hotel'
}

const NOISE = /^(buchungsbestätigung|bestätigung|ihre buchung|booking confirmation|confirmation|reservierungsbestätigung|rechnung|invoice|hallo|guten tag|sehr geehrte|dear|vielen dank|thank you|danke|betreff|subject|von|from|an|to|datum|date)\b/i

/** Name der Unterkunft: hinter „Unterkunft/Hotel/Property:“ oder die erste Zeile mit einem typischen Wort */
export function findStayName(lines: string[]): string {
  for (let i = 0; i < lines.length; i++) {
    const m = /^(?:unterkunft|hotel|objekt|property|accommodation|ihre unterkunft|your (?:property|stay)|gastgeber)\s*:\s*(.+)$/i.exec(lines[i])
    if (m && m[1].length > 2) return m[1].trim()
    if (/^(?:unterkunft|ihre unterkunft|property|accommodation)\s*:?$/i.test(lines[i]) && lines[i + 1]) return lines[i + 1]
  }
  const m = /(?:ihre buchung (?:im|in der|bei|für)|your (?:booking|reservation|stay) (?:at|in)|reservierung (?:im|bei)|aufenthalt (?:im|in der|bei))\s+([^\n,.!]{3,60})/i.exec(lines.join('\n'))
  if (m) return m[1].trim()
  const cand = lines.find((l) => l.length <= 70 && !NOISE.test(l) && STAY_WORDS.some(([re]) => re.test(l)) && !/@|https?:|\d{2}:\d{2}/.test(l))
  return cand ?? ''
}

/** Adresse: Zeile mit Postleitzahl und Ort (DE/AT/CH/IT …), ggf. mit der Straße davor */
export function findAddress(lines: string[]): string {
  for (let i = 0; i < lines.length; i++) {
    const m = /^(?:adresse|anschrift|address)\s*:\s*(.+)$/i.exec(lines[i])
    if (m) return m[1].trim()
  }
  const i = lines.findIndex((l) => /^(?:[A-Z]{1,2}-)?\d{4,5}\s+\p{L}/u.test(l) && l.length < 60 && !/\d{2}:\d{2}/.test(l))
  if (i === -1) {
    const one = lines.find((l) => /\p{L}.*\d+[a-z]?,\s*(?:[A-Z]{1,2}-)?\d{4,5}\s+\p{L}/u.test(l) && l.length < 100)
    return one ?? ''
  }
  const street = i > 0 && /\p{L}.*\s\d+[a-z]?$/u.test(lines[i - 1]) && lines[i - 1].length < 60 ? `${lines[i - 1]}, ` : ''
  const country = lines[i + 1] && /^(deutschland|österreich|oesterreich|schweiz|italien|frankreich|spanien|kroatien|germany|austria|switzerland|italy|france|spain|croatia)$/i.test(lines[i + 1]) ? `, ${lines[i + 1]}` : ''
  return `${street}${lines[i]}${country}`
}

const CHECKIN = /(anreise|ankunft am|check-?in|arrival|einchecken)\b/
const CHECKOUT = /(abreise|check-?out|auschecken|abreisedatum)\b/
const CANCEL = /(kostenlos(?:e)? storn\w*|kostenfrei(?:e)? storn\w*|gebührenfrei storn\w*|storn\w* (?:ist )?(?:bis|kostenlos)|free cancellation|cancel (?:for free|free of charge)|cancellation is free)[^\n]{0,40}?(?:bis|until|before|vor)?/

// ---------------------------------------------------------------- Reise-Etappen

const AIRPORT = /\(([A-Z]{3})\)/g

function legsFromText(text: string, ref: string): LegGuess[] {
  const legs: LegGuess[] = []
  const lines = text.split('\n')
  // Flug: Flugnummer (LH 2110, EW9032, 4U 123) mit Strecke „München (MUC) – Palma (PMI)“
  const flightRe = /\b((?:[A-Z]{2}|[A-Z]\d|\d[A-Z]))\s?(\d{2,4})\b/g
  const isFlightText = /flug|flight|abflug|departure|boarding|airline|airport|flughafen|gate/i.test(text)
  if (isFlightText) {
    let m: RegExpExecArray | null
    const seen = new Set<string>()
    while ((m = flightRe.exec(text))) {
      const number = `${m[1]} ${m[2]}`
      if (seen.has(number) || /^(DE|AT|CH|EU|NR|ID|PL)$/.test(m[1]) && !/flug|flight/i.test(text.slice(Math.max(0, m.index - 40), m.index))) continue
      // nur Codes mit Großbuchstaben, nicht z. B. Postleitzahlen
      const around = text.slice(m.index, m.index + 260)
      const airports = [...around.matchAll(AIRPORT)].map((a) => a[1])
      const before = text.slice(Math.max(0, m.index - 260), m.index)
      const apBefore = [...before.matchAll(AIRPORT)].map((a) => a[1])
      const aps = airports.length >= 2 ? airports : [...apBefore.slice(-2), ...airports].slice(0, 2)
      if (aps.length < 2 && !/flug|flight/i.test(text.slice(Math.max(0, m.index - 30), m.index + 10))) continue
      seen.add(number)
      // Zeile der Flugnummer (+ Folgezeile) für Zeiten und Orte, das nächste Datum davor für den Tag
      const lineStart = text.lastIndexOf('\n', m.index) + 1
      const lineEnd = (() => {
        const e1 = text.indexOf('\n', m.index)
        const e2 = e1 === -1 ? -1 : text.indexOf('\n', e1 + 1)
        return e2 === -1 ? text.length : e2
      })()
      const block = text.slice(lineStart, lineEnd)
      const datesBefore = findDates(text.slice(Math.max(0, lineStart - 200), lineEnd), ref)
      const d = datesBefore.filter((x) => x.index <= m!.index - Math.max(0, lineStart - 200) + 40).pop()?.value ?? findDates(text, ref)[0]?.value ?? ''
      const times = findTimes(block).map((t) => t.value)
      const placeOf = (code: string) => {
        const pm = new RegExp(`([\\p{L} .\\-]{2,40})\\s*\\(${code}\\)`, 'u').exec(block)
        const name = pm?.[1].trim().replace(/^(von|nach|from|to|ab|an)\s+/i, '') ?? ''
        return name ? `${name} (${code})` : code
      }
      legs.push({ mode: 'flug', from: aps[0] ? placeOf(aps[0]) : '', to: aps[1] ? placeOf(aps[1]) : '', date: d, departTime: times[0] ?? '', arriveTime: times[1] ?? '', number })
    }
    if (legs.length) return legs
  }

  // Bahn/Bus/Fähre: „ab Nürnberg Hbf 08:12“ … „an München Hbf 09:15“ oder „Von: … Nach: …“
  const mode: LegMode = /fähre|faehre|ferry|schiff/i.test(text)
    ? 'faehre'
    : /flixbus|fernbus|\bbus\b/i.test(text)
      ? 'bus'
      : /bahn|zug|\bice\b|\bic\b|\bec\b|railjet|\brj\b|öbb|sbb|db fernverkehr|train|gleis|platform|sparpreis|flexpreis/i.test(text)
        ? 'bahn'
        : 'sonstiges'
  const train = /\b(ICE|IC|EC|RJX?|RE|RB|TGV|NJ|ECE|FLX|IR|S)\s?(\d{1,5})\b/.exec(text)
  for (let i = 0; i < lines.length; i++) {
    const ab = /^(?:.*?\b)?(?:ab|abfahrt|departure|dep\.?)\s*:?\s+(.+?)\s+(\d{1,2}:\d{2})\b/i.exec(lines[i])
    if (!ab) continue
    const j = lines.slice(i + 1, i + 8).findIndex((l) => /^(?:.*?\b)?(?:an|ankunft|arrival|arr\.?)\s*:?\s+(.+?)\s+(\d{1,2}:\d{2})\b/i.test(l))
    if (j === -1) continue
    const an = /^(?:.*?\b)?(?:an|ankunft|arrival|arr\.?)\s*:?\s+(.+?)\s+(\d{1,2}:\d{2})\b/i.exec(lines[i + 1 + j])!
    const strip = (s: string) => s.replace(findDates(s, ref)[0] ? /\s*\d{1,2}\.\d{1,2}\.(?:\d{2,4})?\s*/ : /$^/, ' ').trim()
    const ctx = lines.slice(Math.max(0, i - 3), i + 2).join('\n')
    legs.push({
      mode: mode === 'sonstiges' ? 'bahn' : mode,
      from: strip(ab[1]),
      to: strip(an[1]),
      date: findDates(ctx, ref)[0]?.value ?? findDates(text, ref)[0]?.value ?? '',
      departTime: ab[2].padStart(5, '0'),
      arriveTime: an[2].padStart(5, '0'),
      number: train ? `${train[1]} ${train[2]}` : ''
    })
    i += j + 1
  }
  if (legs.length) return legs

  const von = /(?:^|\n)\s*(?:von|from|start|abfahrtsort)\s*:\s*([^\n]+)/i.exec(text)
  const nach = /(?:^|\n)\s*(?:nach|to|ziel|zielort|destination)\s*:\s*([^\n]+)/i.exec(text)
  if (von && nach && mode !== 'sonstiges') {
    const times = findTimes(text).map((t) => t.value)
    legs.push({ mode, from: von[1].trim(), to: nach[1].trim(), date: findDates(text, ref)[0]?.value ?? '', departTime: times[0] ?? '', arriveTime: times[1] ?? '', number: train ? `${train[1]} ${train[2]}` : '' })
  }
  return legs
}

// ---------------------------------------------------------------- Kalenderdatei

export interface IcsEvent {
  summary: string
  location: string
  description: string
  start: string
  startTime: string
  end: string
  endTime: string
  allDay: boolean
}

/** VEVENTs aus einer .ics-Datei (Zeilen-Faltung, Escapes, DATE und DATE-TIME) */
export function parseIcs(text: string): IcsEvent[] {
  const unfolded = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '')
  const events: IcsEvent[] = []
  for (const block of unfolded.split('BEGIN:VEVENT').slice(1)) {
    const body = block.split('END:VEVENT')[0]
    const get = (name: string) => {
      const m = new RegExp(`^${name}(;[^:\\n]*)?:(.*)$`, 'mi').exec(body)
      return m ? { params: m[1] ?? '', value: m[2].replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').trim() } : null
    }
    const dt = (p: { params: string; value: string } | null) => {
      if (!p) return { date: '', time: '', allDay: false }
      const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/.exec(p.value)
      if (!m) return { date: '', time: '', allDay: false }
      let date = `${m[1]}-${m[2]}-${m[3]}`
      let time = m[4] ? `${m[4]}:${m[5]}` : ''
      // UTC-Zeit (…Z) in die Ortszeit des Geräts umrechnen
      if (time && /Z$/.test(p.value)) {
        const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]))
        date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
        time = `${pad(d.getHours())}:${pad(d.getMinutes())}`
      }
      return { date, time, allDay: /VALUE=DATE(?!-)/i.test(p.params) || !m[4] }
    }
    const s = dt(get('DTSTART'))
    const e = dt(get('DTEND'))
    events.push({
      summary: get('SUMMARY')?.value ?? '',
      location: get('LOCATION')?.value ?? '',
      description: get('DESCRIPTION')?.value ?? '',
      start: s.date,
      startTime: s.time,
      end: e.date,
      endTime: e.time,
      allDay: s.allDay
    })
  }
  return events.filter((e) => e.start)
}

// ---------------------------------------------------------------- Gesamt

const emptyStay = (): StayGuess => ({ name: '', type: 'hotel', address: '', checkIn: '', checkOut: '', price: null, currency: 'EUR', bookingRef: '', cancelUntil: '', url: '' })

/**
 * Buchung erkennen. `ref` ist ein Bezugsdatum (z. B. Reisebeginn), um fehlende Jahreszahlen zu ergänzen.
 */
export function parseBooking(raw: string, ref = ''): BookingGuess {
  // Kalenderdatei roh lesen (Zeilen-Faltung braucht das führende Leerzeichen)
  if (/BEGIN:VCALENDAR/i.test(raw)) return fromIcs(raw, ref)
  const text = normalizeText(raw)
  const lines = text.split('\n').filter(Boolean)
  const found: string[] = []
  const price = findPrice(text)
  const bookingRef = findBookingRef(text)
  if (price) found.push(t('Preis'))
  if (bookingRef) found.push(t('Buchungsnummer'))

  let inD = dateAfter(text, CHECKIN, ref)
  let outD = dateAfter(text, CHECKOUT, ref, 120)
  // „vom 4. bis 9. Oktober 2026“ / „04.10.–09.10.2026“
  if (!inD || !outD) {
    const range =
      /\b(?:vom|from)\s+(\S.{0,38}?)\s*(?:bis|–|-|to|until)\s*([^\n]{4,40})/i.exec(text) ??
      /\b(\d{1,2}\.\d{1,2}\.(?:\d{2,4})?)\s*[–-]\s*(\d{1,2}\.\d{1,2}\.\d{2,4})/.exec(text)
    if (range) {
      const second = findDates(range[2], ref)[0]
      const year = second?.value.slice(0, 4) ?? ''
      const a = range[1].trim()
      let first = /\d{4}/.test(a) ? findDates(a, ref)[0]?.value : undefined
      if (!first && second && /^\d{1,2}\.?$/.test(a)) first = `${second.value.slice(0, 8)}${a.replace(/\D/g, '').padStart(2, '0')}`
      if (!first && second) first = findDates(`${a} ${year}`, `${year}-06-01`)[0]?.value ?? findDates(a, second.value)[0]?.value
      if (first && second && first < second.value) {
        inD = { value: first, index: range.index, end: range.index }
        outD = { value: second.value, index: range.index, end: range.index }
      }
    }
  }
  const nightsWord = /(\d{1,2})\s*(nächte|naechte|nacht|nights?|übernachtungen)/i.exec(text)
  const stayHint = /(übernachtung|nächte|nights|check-?in|check-?out|zimmer|room|unterkunft|accommodation|hotel|ferienwohnung|apartment|gastgeber|host|anreise|abreise|frühstück|breakfast|booking\.com|airbnb|hrs|expedia|fewo)/i
  const legs = legsFromText(text, ref)
  const travelHint = legs.length > 0 && !(inD && outD && /zimmer|room|nächte|nights|übernachtung/i.test(text))

  if (!travelHint && (stayHint.test(text) || (inD && outD))) {
    const stay = emptyStay()
    stay.name = findStayName(lines)
    stay.type = stayType(`${stay.name} ${text.slice(0, 400)}`)
    stay.address = findAddress(lines)
    // Anreise/Abreise; sonst die ersten beiden Daten bzw. Anreise + Anzahl Nächte
    const dates = findDates(text, ref).map((d) => d.value)
    stay.checkIn = inD?.value ?? dates[0] ?? ''
    stay.checkOut = outD && outD.value > stay.checkIn ? outD.value : (dates.find((d) => d > stay.checkIn) ?? '')
    if (stay.checkIn && nightsWord && (!stay.checkOut || stay.checkOut <= stay.checkIn)) {
      const d = new Date(`${stay.checkIn}T12:00:00Z`)
      d.setUTCDate(d.getUTCDate() + Number(nightsWord[1]))
      stay.checkOut = d.toISOString().slice(0, 10)
    }
    const cancel = dateAfter(text, CANCEL, ref, 140)
    if (cancel && cancel.value <= (stay.checkIn || '9999')) stay.cancelUntil = cancel.value
    stay.price = price?.amount ?? null
    stay.currency = price?.currency ?? 'EUR'
    stay.bookingRef = bookingRef
    stay.url = /https?:\/\/[^\s<>"]*(booking\.com|airbnb\.[a-z.]+|hrs\.[a-z]+|expedia\.[a-z.]+|fewo-direkt\.de|traum-ferienwohnungen\.de)[^\s<>"]*/i.exec(text)?.[0] ?? ''
    if (stay.name) found.push(t('Name'))
    if (stay.checkIn) found.push(t('Anreise'))
    if (stay.checkOut) found.push(t('Abreise'))
    if (stay.address) found.push(t('Adresse'))
    if (stay.cancelUntil) found.push(t('Stornofrist'))
    return { kind: 'unterkunft', stay, legs: [], price: stay.price, currency: stay.currency, bookingRef, found }
  }

  if (legs.length) {
    found.push(tn(legs.length, '1 Etappe', '{n} Etappen'))
    if (legs.some((l) => l.departTime)) found.push(t('Uhrzeiten'))
    return { kind: 'reise', stay: emptyStay(), legs, price: price?.amount ?? null, currency: price?.currency ?? 'EUR', bookingRef, found }
  }
  return { kind: 'unbekannt', stay: emptyStay(), legs: [], price: price?.amount ?? null, currency: price?.currency ?? 'EUR', bookingRef, found }
}

function fromIcs(text: string, ref: string): BookingGuess {
  const events = parseIcs(text)
  const found = events.length ? [t('Kalendereintrag')] : []
  const multiDay = events.find((e) => e.end && e.end > e.start && (e.allDay || /hotel|unterkunft|check|aufenthalt|stay|booking|ferien/i.test(e.summary)))
  if (multiDay) {
    const stay = emptyStay()
    stay.name = multiDay.summary.replace(/^(aufenthalt|stay|reservierung|booking|buchung)\s*(im|in|at|bei|:)?\s*/i, '').trim()
    stay.type = stayType(`${multiDay.summary} ${multiDay.description}`)
    stay.address = multiDay.location
    stay.checkIn = multiDay.start
    stay.checkOut = multiDay.end
    stay.bookingRef = findBookingRef(multiDay.description)
    const p = findPrice(multiDay.description)
    stay.price = p?.amount ?? null
    stay.currency = p?.currency ?? 'EUR'
    return { kind: 'unterkunft', stay, legs: [], price: stay.price, currency: stay.currency, bookingRef: stay.bookingRef, found: [...found, t('Anreise'), t('Abreise')] }
  }
  const legs: LegGuess[] = events
    .filter((e) => e.startTime)
    .map((e) => {
      const fromTo = /(?:^|\s)(?:von\s+)?(.+?)\s*(?:→|->|–|-|nach|to)\s*(.+)$/i.exec(e.summary.replace(/^(flug|flight|zug|train|bahn|bus|fähre)\s*:?\s*/i, ''))
      const mode: LegMode = /flug|flight|\b[A-Z]{2}\s?\d{2,4}\b/i.test(e.summary) ? 'flug' : /zug|bahn|train|ice|\bic\b/i.test(e.summary) ? 'bahn' : /bus/i.test(e.summary) ? 'bus' : /fähre|ferry/i.test(e.summary) ? 'faehre' : 'sonstiges'
      return { mode, from: fromTo?.[1]?.trim() ?? e.location, to: fromTo?.[2]?.trim() ?? '', date: e.start, departTime: e.startTime, arriveTime: e.endTime, number: /\b([A-Z]{2}\s?\d{2,4}|ICE\s?\d+|IC\s?\d+)\b/.exec(e.summary)?.[1] ?? '' }
    })
  void ref
  return { kind: legs.length ? 'reise' : 'unbekannt', stay: emptyStay(), legs, price: null, currency: 'EUR', bookingRef: findBookingRef(events.map((e) => e.description).join('\n')), found }
}
