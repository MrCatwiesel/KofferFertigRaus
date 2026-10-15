import { addDays, diffDays, todayIso } from '../../core/dates'
import { describeCode, FORECAST_DAYS, type DailyWeather } from '../../services/weather'
import { formatRanges, openOn, WEEKDAY_NAMES, weekdayOf } from '../../services/openingHours'
import type { Activity } from '../activity/types'
import { t } from '@/i18n'

/** Ab so vielen Stunden Programm gilt ein Tag als voll. */
export const FULL_DAY_HOURS = 8
/** Nach so vielen Stunden wird das Wetter neu geladen (wenn online). */
export const WEATHER_MAX_AGE_HOURS = 3

export function isRainy(w: DailyWeather): boolean {
  const kind = describeCode(w.code).kind
  return kind === 'regen' || kind === 'gewitter' || kind === 'schnee' || (w.precipitationProbability ?? 0) >= 60 || w.precipitation >= 3
}

export function isNice(w: DailyWeather): boolean {
  return !isRainy(w) && describeCode(w.code).kind === 'sonnig' && w.tempMax >= 15
}

/** Alle Tage der Reise als ISO-Daten. */
export function tripDates(start: string, end: string): string[] {
  const n = diffDays(start, end)
  return Array.from({ length: Math.max(0, n) + 1 }, (_, i) => addDays(start, i))
}

/** Liegt das Datum im Vorhersagezeitraum (heute bis heute + 15)? */
export function inForecastRange(date: string, today: Date = new Date()): boolean {
  const d = diffDays(todayIso(today), date)
  return d >= 0 && d < FORECAST_DAYS
}

/** Ab wann es für dieses Datum eine Vorhersage gibt. */
export function forecastAvailableFrom(date: string): string {
  return addDays(date, -(FORECAST_DAYS - 1))
}

export function isStale(fetchedAt: string | undefined, now: Date = new Date()): boolean {
  if (!fetchedAt) return true
  return now.getTime() - Date.parse(fetchedAt) > WEATHER_MAX_AGE_HOURS * 3_600_000
}

/** Tag beim Öffnen: heute, wenn die Reise läuft; sonst der erste Reisetag. */
export function initialDay(start: string, end: string, today: Date = new Date()): string {
  const t = todayIso(today)
  return t >= start && t <= end ? t : start
}

export interface PlannedEntry {
  activity: Activity
  warnings: string[]
  /** Bessere Alternative bei schlechtem Wetter */
  alternative?: Activity
}

export interface Suggestion {
  activity: Activity
  score: number
  reasons: string[]
  /** Hinweise, die nicht in die Bewertung eingehen (z. B. Reservierung) */
  notes: string[]
}

export interface DayPlan {
  planned: PlannedEntry[]
  suggestions: Suggestion[]
  /** An diesem Tag geschlossen */
  closed: { activity: Activity; reason: string }[]
  plannedHours: number
  dayWarnings: string[]
}

const PRIORITY_SCORE = { 1: 30, 2: 20, 3: 10 } as const

/**
 * Plant einen Tag: bewertet die geplanten Unternehmungen (Wetter, Öffnungszeiten)
 * und schlägt passende offene Ideen vor.
 */
export function planDay(date: string, activities: Activity[], weather?: DailyWeather): DayPlan {
  const rainy = weather ? isRainy(weather) : false
  const nice = weather ? isNice(weather) : false
  const weekday = WEEKDAY_NAMES[weekdayOf(date)]

  const plannedHere = activities
    .filter((a) => a.plannedDate === date && a.status !== 'verworfen')
    .sort((a, b) => Number(a.status === 'erledigt') - Number(b.status === 'erledigt') || a.priority - b.priority)
  const plannedHours = plannedHere.reduce((s, a) => s + (a.durationHours ?? 0), 0)

  // Kandidaten: offene Ideen ohne festen Tag
  const pool = activities.filter((a) => !a.plannedDate && (a.status === 'idee' || a.status === 'geplant'))
  const suggestions: Suggestion[] = []
  const closed: DayPlan['closed'] = []

  for (const a of pool) {
    const open = openOn(a.openingHours, date)
    if (open.state === 'geschlossen') {
      closed.push({ activity: a, reason: t('{weekday} geschlossen', { weekday }) })
      continue
    }
    let score: number = PRIORITY_SCORE[a.priority]
    const reasons: string[] = []
    const notes: string[] = []
    if (a.priority === 1) reasons.push(t('Muss-Ziel'))

    if (weather) {
      if (rainy) {
        if (a.setting === 'innen') {
          score += 25
          reasons.push(t('Drinnen – gut bei Regen'))
        } else if (a.setting === 'gemischt') {
          score += 5
        } else {
          score -= 40
          reasons.push(t('Draußen – bei Regen ungünstig'))
        }
      } else if (nice) {
        if (a.setting === 'aussen') {
          score += 15
          reasons.push(t('Draußen – schönes Wetter'))
        } else if (a.setting === 'innen') {
          score -= 5
        }
      }
    }

    if (open.state === 'offen') {
      score += 5
      reasons.push(t('geöffnet {formatRanges}', { formatRanges: formatRanges(open.hours) }))
    }
    if (a.durationHours && plannedHours + a.durationHours > FULL_DAY_HOURS) {
      score -= 10
      notes.push(t('Tag würde sehr voll'))
    }
    if (a.bookingRequired) notes.push(t('Reservierung nötig'))
    suggestions.push({ activity: a, score, reasons, notes })
  }

  suggestions.sort((x, y) => y.score - x.score || x.activity.title.localeCompare(y.activity.title, 'de'))
  const indoorAlternatives = suggestions.filter((s) => s.activity.setting === 'innen' && s.score > 0)

  const planned: PlannedEntry[] = plannedHere.map((a) => {
    const warnings: string[] = []
    let alternative: Activity | undefined
    if (a.status !== 'erledigt') {
      const open = openOn(a.openingHours, date)
      if (open.state === 'geschlossen') warnings.push(t('Am {weekday} geschlossen', { weekday }))
      if (rainy && a.setting === 'aussen') {
        warnings.push(t('Regen erwartet'))
        alternative = indoorAlternatives[0]?.activity
      }
    }
    return { activity: a, warnings, alternative }
  })

  const dayWarnings: string[] = []
  if (plannedHours > FULL_DAY_HOURS) dayWarnings.push(t('Über {FULL_DAY_HOURS} Stunden Programm – Pausen einplanen', { FULL_DAY_HOURS }))
  if (weather && weather.tempMax >= 32) dayWarnings.push(t('Sehr heiß – Programm in den Morgen oder Abend legen, viel trinken'))

  return { planned, suggestions, closed, plannedHours, dayWarnings }
}
