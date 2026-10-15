import { t, intlLocale } from '@/i18n'
/**
 * Einfacher Parser für Öffnungszeiten als Freitext – deutsch, englisch und im OpenStreetMap-Stil:
 *   "Di–So 10–18 Uhr", "Mo-Fr 9:00-17:30; Sa 10-14", "täglich 9–19", "Mo geschlossen",
 *   "Tu-Su 10:00-18:00", "24/7", "Mo, Mi, Fr 8-12", "Tue to Sun 10-18", "Mon closed"
 * Was nicht erkannt wird, gilt als "unbekannt" – die App rät dann nicht.
 */

/** 0 = Montag … 6 = Sonntag */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

export interface TimeRange {
  /** Minuten ab Mitternacht */
  from: number
  to: number
}

/** Je Wochentag: null = unbekannt, [] = geschlossen, sonst Zeitfenster */
export type WeekHours = (TimeRange[] | null)[]

const DAY_TOKENS: Record<string, Weekday> = {
  mo: 0, montag: 0, di: 1, dienstag: 1, tu: 1, mi: 2, mittwoch: 2, we: 2, do: 3, donnerstag: 3, th: 3,
  fr: 4, freitag: 4, sa: 5, samstag: 5, so: 6, sonntag: 6, su: 6,
  // englisch
  mon: 0, monday: 0, tue: 1, tues: 1, tuesday: 1, wed: 2, wednesday: 2, thu: 3, thur: 3, thurs: 3, thursday: 3,
  fri: 4, friday: 4, sat: 5, saturday: 5, sun: 6, sunday: 6
}

const ALL_DAYS: Weekday[] = [0, 1, 2, 3, 4, 5, 6]

function dayOf(token: string): Weekday | null {
  const t = token.toLowerCase().replace(/\.$/, '')
  return t in DAY_TOKENS ? DAY_TOKENS[t] : null
}

function rangeDays(a: Weekday, b: Weekday): Weekday[] {
  const out: Weekday[] = []
  let d = a
  for (let i = 0; i < 7; i++) {
    out.push(d)
    if (d === b) break
    d = ((d + 1) % 7) as Weekday
  }
  return out
}

/** Liest den Tagesteil, z. B. "Di–So", "Mo, Mi, Fr", "täglich". */
function parseDays(spec: string): Weekday[] | null {
  const s = spec.trim().toLowerCase()
  if (!s || /^(täglich|taeglich|tgl\.?|jeden tag|mo-so|mo–so|daily|every day|everyday)$/.test(s)) return [...ALL_DAYS]
  const out = new Set<Weekday>()
  for (const part of s.split(/\s*[,+&]\s*|\s+(?:und|and)\s+/)) {
    const m = part.match(/^([a-zäöü.]+)\s*(?:-|–|—|bis|to)\s*([a-zäöü.]+)$/)
    if (m) {
      const a = dayOf(m[1])
      const b = dayOf(m[2])
      if (a === null || b === null) return null
      rangeDays(a, b).forEach((d) => out.add(d))
      continue
    }
    const d = dayOf(part)
    if (d === null) return null
    out.add(d)
  }
  return out.size ? [...out] : null
}

function toMin(h: string, m?: string): number {
  return Number(h) * 60 + Number(m ?? 0)
}

/** Liest Zeitfenster, z. B. "10–18", "9:00-12:30, 14-18". */
function parseTimes(spec: string): TimeRange[] | null {
  const s = spec.replace(/uhr|h\b/gi, '').trim()
  const re = /(\d{1,2})(?:[:.](\d{2}))?\s*(?:-|–|—|bis|to)\s*(\d{1,2})(?:[:.](\d{2}))?/g
  const out: TimeRange[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(s))) {
    const from = toMin(m[1], m[2])
    let to = toMin(m[3], m[4])
    if (to <= from) to += 24 * 60 // über Mitternacht, z. B. 18-2
    out.push({ from, to })
  }
  return out.length ? out : null
}

/** Wandelt einen Freitext in Öffnungszeiten je Wochentag um. */
export function parseOpeningHours(text: string): WeekHours {
  const week: WeekHours = [null, null, null, null, null, null, null]
  const src = text.trim()
  if (!src) return week
  if (/^24\s*\/\s*7$/.test(src) || /rund um die uhr|immer geöffnet|immer offen|open 24 hours|always open/i.test(src)) {
    return ALL_DAYS.map(() => [{ from: 0, to: 24 * 60 }])
  }
  let understood = false
  for (const segment of src.split(/\s*[;|\n]\s*/)) {
    if (!segment) continue
    // "Mo geschlossen", "Mo: Ruhetag", "Mo off"
    const closed = segment.match(/^(.+?)\s*:?\s*(geschlossen|ruhetag|zu|off|closed)$/i)
    if (closed) {
      const days = parseDays(closed[1])
      if (days) {
        days.forEach((d) => (week[d] = []))
        understood = true
      }
      continue
    }
    // Tagesteil = alles vor der ersten Ziffer
    const idx = segment.search(/\d/)
    if (idx < 0) continue
    const dayPart = segment.slice(0, idx).replace(/:$/, '').trim()
    const times = parseTimes(segment.slice(idx))
    const days = dayPart ? parseDays(dayPart) : [...ALL_DAYS]
    if (!days || !times) continue
    // Spätere Angaben für einen Tag ersetzen frühere (wie bei OpenStreetMap)
    days.forEach((d) => (week[d] = [...times]))
    understood = true
  }
  // Wurde etwas erkannt, sind nicht genannte Tage geschlossen
  return understood ? week.map((d) => d ?? []) : week
}

/** Wochentag eines ISO-Datums (0 = Montag). */
export function weekdayOf(isoDate: string): Weekday {
  const [y, m, d] = isoDate.split('-').map(Number)
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) as Weekday
}

export type OpenState = { state: 'offen' | 'geschlossen' | 'unbekannt'; hours: TimeRange[] }

/** Ist an diesem Datum geöffnet? */
export function openOn(text: string, isoDate: string): OpenState {
  const day = parseOpeningHours(text)[weekdayOf(isoDate)]
  if (day === null) return { state: 'unbekannt', hours: [] }
  return day.length ? { state: 'offen', hours: day } : { state: 'geschlossen', hours: [] }
}

export function formatRanges(ranges: TimeRange[]): string {
  const f = (m: number) => {
    const mm = m % (24 * 60)
    const h = Math.floor(mm / 60)
    const r = mm % 60
    return r ? `${h}:${String(r).padStart(2, '0')}` : `${h}`
  }
  return ranges.map((r) => (r.from === 0 && r.to === 24 * 60 ? t('rund um die Uhr') : `${f(r.from)}–${f(r.to)}`)).join(', ')
}

/** Namen der Wochentage in der gewählten Sprache, Montag zuerst */
export const WEEKDAY_NAMES = Array.from({ length: 7 }, (_, i) =>
  new Intl.DateTimeFormat(intlLocale(), { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2024, 0, 1 + i)))
)
