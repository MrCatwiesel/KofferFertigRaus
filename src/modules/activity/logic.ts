import type { Activity, ActivityCategory, ActivityDraft, ActivitySetting, ActivityStatus } from './types'
import { t } from '@/core/i18n'

export function emptyActivityDraft(currency = 'EUR'): ActivityDraft {
  return {
    title: '',
    category: 'kultur',
    place: '',
    url: '',
    setting: 'aussen',
    priority: 2,
    durationHours: null,
    pricePerPerson: null,
    currency,
    openingHours: '',
    bookingRequired: false,
    status: 'idee',
    plannedDate: '',
    notes: ''
  }
}

export function validateActivity(
  d: ActivityDraft,
  trip?: { startDate: string; endDate: string }
): Partial<Record<keyof ActivityDraft, string>> {
  const e: Partial<Record<keyof ActivityDraft, string>> = {}
  if (!d.title.trim()) e.title = t('Bitte einen Namen angeben.')
  if (d.durationHours !== null && d.durationHours <= 0) e.durationHours = t('Dauer muss größer als 0 sein.')
  if (d.pricePerPerson !== null && d.pricePerPerson < 0) e.pricePerPerson = t('Preis darf nicht negativ sein.')
  if (trip && d.plannedDate && (d.plannedDate < trip.startDate || d.plannedDate > trip.endDate)) {
    e.plannedDate = t('Der Tag liegt außerhalb der Reise.')
  }
  return e
}

/** Geschätzte Kosten für alle Reisenden. */
export function estimatedCost(a: Pick<Activity, 'pricePerPerson'>, travelers: number): number {
  return (a.pricePerPerson ?? 0) * Math.max(1, travelers)
}

/** Summe der geschätzten Kosten (ohne Verworfenes) in der angegebenen Währung. */
export function totalEstimatedCost(list: Activity[], travelers: number, currency: string): number {
  return list
    .filter((a) => a.status !== 'verworfen' && a.currency === currency)
    .reduce((sum, a) => sum + estimatedCost(a, travelers), 0)
}

export interface ActivityFilter {
  category?: ActivityCategory | ''
  setting?: ActivitySetting | ''
  /** Verworfene und erledigte ausblenden */
  openOnly?: boolean
}

const STATUS_ORDER: Record<ActivityStatus, number> = { geplant: 0, idee: 1, erledigt: 2, verworfen: 3 }

/**
 * Filtert und sortiert: Geplantes zuerst (nach Tag), dann Ideen nach Priorität,
 * Erledigtes und Verworfenes am Ende.
 */
export function filterAndSort(list: Activity[], f: ActivityFilter = {}): Activity[] {
  return list
    .filter((a) => !f.category || a.category === f.category)
    .filter((a) => !f.setting || a.setting === f.setting)
    .filter((a) => !f.openOnly || (a.status !== 'erledigt' && a.status !== 'verworfen'))
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        (a.plannedDate || '9999').localeCompare(b.plannedDate || '9999') ||
        a.priority - b.priority ||
        a.title.localeCompare(b.title, 'de')
    )
}

/** Zählt Unternehmungen je Status. */
export function countByStatus(list: Activity[]): Record<ActivityStatus, number> {
  const c: Record<ActivityStatus, number> = { idee: 0, geplant: 0, erledigt: 0, verworfen: 0 }
  for (const a of list) c[a.status]++
  return c
}

/**
 * Offene Unternehmungen, die bei Regen gehen (drinnen oder gemischt) –
 * Vorbereitung für den wetterabhängigen Tagesplaner (M3).
 */
export function rainyDayOptions(list: Activity[]): Activity[] {
  return filterAndSort(list, { openOnly: true }).filter((a) => a.setting !== 'aussen')
}

/** Geplante Stunden pro Tag, um überladene Tage zu erkennen. */
export function plannedHoursByDay(list: Activity[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const a of list) {
    if (a.status === 'verworfen' || !a.plannedDate) continue
    out[a.plannedDate] = (out[a.plannedDate] ?? 0) + (a.durationHours ?? 0)
  }
  return out
}
