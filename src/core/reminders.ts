/**
 * Termine und Fristen – jedes Modul liefert seine (Stornofrist, Check-in, Abfahrt, Impftermin …),
 * hier werden sie gesammelt, sortiert und als Kalenderdatei (iCalendar, RFC 5545) ausgegeben.
 * Reine Logik ohne Datenbank (testbar).
 */
import { diffDays } from './dates'
import { t, intlLocale } from '@/i18n'

export type ReminderKind = 'frist' | 'termin' | 'reise' | 'pruefen'

export interface Reminder {
  /** Stabile Kennung, z. B. "acc:<id>:storno" – wird zur UID im Kalender */
  id: string
  tripId: string
  /** ISO-Datum YYYY-MM-DD */
  date: string
  /** "HH:MM" – ohne Uhrzeit ganztägig */
  time?: string
  /** Ende "HH:MM" (gleicher Tag) */
  endTime?: string
  /** Mehrtägig: letzter Tag (ISO-Datum) */
  endDate?: string
  title: string
  detail?: string
  location?: string
  kind: ReminderKind
  /** Link in der App */
  to?: string
  /** Erinnerung so viele Minuten vor Beginn (Kalender); Standard je Art */
  alarmMinutes?: number
}

export interface ReminderTrip {
  id: string
  title: string
  destination: string
  startDate: string
  endDate: string
}

export const KIND_LABEL: Record<ReminderKind, { label: string; icon: string }> = {
  frist: { label: t('Frist'), icon: 'hourglass-split' },
  termin: { label: t('Termin'), icon: 'calendar-event' },
  reise: { label: t('Reise'), icon: 'suitcase' },
  pruefen: { label: t('Zu erledigen'), icon: 'check2-square' }
}

/** Standard-Vorwarnung: Fristen 2 Tage, Termine 2 Stunden, ganztägige Reisetage am Vorabend 18 Uhr */
export function defaultAlarm(r: Reminder): number {
  if (r.alarmMinutes !== undefined) return r.alarmMinutes
  if (r.kind === 'frist') return 2 * 24 * 60
  if (r.time) return 120
  return 6 * 60 // ganztägig beginnt um 0 Uhr → 18 Uhr am Vortag
}

/** Erst nach Datum, dann Uhrzeit (ganztägig zuerst) */
export function sortReminders(list: Reminder[]): Reminder[] {
  return [...list].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '') || a.title.localeCompare(b.title, 'de'))
}

export type ReminderGroup = 'ueberfaellig' | 'heute' | 'woche' | 'spaeter' | 'vorbei'

/** Zu erledigen und überfällig → oben; Termine von gestern → „vorbei“ */
export function groupOf(r: Reminder, today: string): ReminderGroup {
  const last = r.endDate ?? r.date
  if (last < today) return r.kind === 'pruefen' ? 'ueberfaellig' : 'vorbei'
  if (r.date <= today) return 'heute'
  const week = new Date(`${today}T12:00:00Z`)
  week.setUTCDate(week.getUTCDate() + 7)
  return r.date <= week.toISOString().slice(0, 10) ? 'woche' : 'spaeter'
}

/** Datum verschieben (Tage), ISO */
export function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Datum nicht vor heute (für Aufgaben, deren idealer Zeitpunkt schon vorbei ist) */
export const notBefore = (iso: string, today: string) => (iso < today ? today : iso)

// ---------------------------------------------------------------- iCalendar

const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Zeilen auf 75 Bytes falten (RFC 5545 3.1), UTF-8-sicher */
export function foldLine(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const out: string[] = []
  let cur = ''
  let size = 0
  for (const ch of line) {
    const n = enc.encode(ch).length
    if (size + n > (out.length ? 74 : 75)) {
      out.push(cur)
      cur = ''
      size = 0
    }
    cur += ch
    size += n
  }
  out.push(cur)
  return out.join('\r\n ')
}

const ymd = (iso: string) => iso.replace(/-/g, '')
const hm = (t: string) => `${t.replace(':', '')}00`
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

/**
 * Kalenderdatei. `name` erscheint als Kalendername beim Abonnieren.
 * Zeiten sind „schwebend“ (ohne Zeitzone) – sie gelten in der Zeitzone des Geräts, wie auf dem Ticket.
 */
export function buildIcs(reminders: Reminder[], opts: { name: string; appUrl?: string; now?: Date } = { name: 'KofferFertigRaus' }): string {
  const now = stamp(opts.now ?? new Date())
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//KofferFertigRaus//Reiseplaner//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(opts.name)}`,
    'X-PUBLISHED-TTL:PT1H',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H'
  ]
  for (const r of sortReminders(reminders)) {
    lines.push('BEGIN:VEVENT', `UID:${r.id.replace(/[^\w:.-]/g, '-')}@koffer-fertig-raus`, `DTSTAMP:${now}`)
    if (r.time) {
      lines.push(`DTSTART:${ymd(r.date)}T${hm(r.time)}`)
      if (r.endTime && r.endTime > r.time) lines.push(`DTEND:${ymd(r.date)}T${hm(r.endTime)}`)
      else lines.push('DURATION:PT30M')
    } else {
      lines.push(`DTSTART;VALUE=DATE:${ymd(r.date)}`, `DTEND;VALUE=DATE:${ymd(shiftDate(r.endDate ?? r.date, 1))}`)
      lines.push('TRANSP:TRANSPARENT') // ganztägig blockiert nicht den Tag
    }
    lines.push(`SUMMARY:${esc(r.title)}`)
    const desc = [r.detail, opts.appUrl && r.to ? `${opts.appUrl}#${r.to}` : ''].filter(Boolean).join('\n')
    if (desc) lines.push(`DESCRIPTION:${esc(desc)}`)
    if (r.location) lines.push(`LOCATION:${esc(r.location)}`)
    lines.push(`CATEGORIES:${esc(KIND_LABEL[r.kind].label)}`)
    const alarm = defaultAlarm(r)
    if (alarm >= 0) {
      const d = Math.floor(alarm / 1440)
      const h = Math.floor((alarm % 1440) / 60)
      const m = alarm % 60
      const trig = `-P${d ? `${d}D` : ''}${h || m ? `T${h ? `${h}H` : ''}${m ? `${m}M` : ''}` : d ? '' : 'T0M'}`
      lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(r.title)}`, `TRIGGER:${trig}`, 'END:VALARM')
    }
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

// ---------------------------------------------------------------- Push-Benachrichtigungen

/** Eine Erinnerung für den Server (Zeitpunkt absolut, UTC) */
export interface PushItem {
  id: string
  /** Zeitpunkt der Benachrichtigung (ISO, UTC) */
  at: string
  title: string
  body: string
  /** Link in der App (#/…) */
  url: string
}

const pad = (n: number) => String(n).padStart(2, '0')
const localIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/** „heute 14:30“, „morgen“, „in 3 Tagen (Fr., 24.10.)“ – vom Zeitpunkt der Benachrichtigung aus gesehen */
export function whenLabel(r: Reminder, at: Date): string {
  const days = diffDays(localIso(at), r.date)
  const day =
    days === 0
      ? t('heute')
      : days === 1
        ? t('morgen')
        : days === 2
          ? t('übermorgen')
          : t('in {n} Tagen ({date})', { n: days, date: new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' }).format(new Date(`${r.date}T12:00:00Z`)) })
  return r.time ? t('{day} {time} Uhr', { day, time: r.time }) : day
}

/**
 * Zeitplan für Push-Benachrichtigungen: je Termin ein Zeitpunkt (Beginn minus Vorwarnung, in der Zeitzone
 * des Geräts – wie im Kalender). Nur, was noch kommt und in `days` Tagen fällig wird.
 */
export function pushItems(reminders: Reminder[], now: Date = new Date(), days = 60): PushItem[] {
  const until = now.getTime() + days * 86400_000
  const out: PushItem[] = []
  for (const r of sortReminders(reminders)) {
    const alarm = defaultAlarm(r)
    if (alarm < 0) continue
    const [y, m, d] = r.date.split('-').map(Number)
    const [hh, mm] = (r.time ?? '00:00').split(':').map(Number)
    const at = new Date(y, m - 1, d, hh, mm - alarm)
    if (at.getTime() <= now.getTime() || at.getTime() > until) continue
    const detail = (r.detail ?? '').split('\n').map((s) => s.trim()).filter(Boolean)
    const body = [whenLabel(r, at), ...detail, r.location].filter(Boolean).join(' · ')
    out.push({ id: r.id, at: at.toISOString(), title: r.title, body: body.slice(0, 300), url: r.to ? `#${r.to}` : '' })
  }
  return out.slice(0, 500)
}
