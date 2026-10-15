import { addDays, diffDays, todayIso } from '../../core/dates'
import type { Accommodation, AccommodationDraft } from './types'
import { t } from '@/i18n'

export function emptyAccommodationDraft(checkIn = '', checkOut = '', currency = 'EUR'): AccommodationDraft {
  return {
    name: '',
    type: 'hotel',
    address: '',
    url: '',
    checkIn,
    checkOut,
    price: null,
    currency,
    status: 'idee',
    bookingRef: '',
    cancelUntil: '',
    notes: ''
  }
}

/** Anzahl Übernachtungen. */
export function nights(checkIn: string, checkOut: string): number {
  return Math.max(0, diffDays(checkIn, checkOut))
}

/** Preis pro Nacht, oder null ohne Preis. */
export function pricePerNight(a: Pick<Accommodation, 'price' | 'checkIn' | 'checkOut'>): number | null {
  const n = nights(a.checkIn, a.checkOut)
  if (a.price === null || n === 0) return null
  return a.price / n
}

export function validateAccommodation(d: AccommodationDraft): Partial<Record<keyof AccommodationDraft, string>> {
  const e: Partial<Record<keyof AccommodationDraft, string>> = {}
  if (!d.name.trim()) e.name = t('Bitte einen Namen angeben.')
  if (!d.checkIn) e.checkIn = t('Bitte Anreisetag wählen.')
  if (!d.checkOut) e.checkOut = t('Bitte Abreisetag wählen.')
  if (d.checkIn && d.checkOut && d.checkOut <= d.checkIn) e.checkOut = t('Abreise muss nach der Anreise liegen.')
  if (d.price !== null && d.price < 0) e.price = t('Preis darf nicht negativ sein.')
  if (d.cancelUntil && d.checkIn && d.cancelUntil > d.checkIn) e.cancelUntil = t('Stornofrist liegt nach der Anreise.')
  return e
}

/** Hinweis, wenn die Unterkunft außerhalb des Reisezeitraums liegt (kein Fehler). */
export function outsideTripWarning(d: Pick<AccommodationDraft, 'checkIn' | 'checkOut'>, tripStart: string, tripEnd: string): string | null {
  if (!d.checkIn || !d.checkOut) return null
  if (d.checkIn < tripStart || d.checkOut > tripEnd) return t('Liegt teilweise außerhalb des Reisezeitraums.')
  return null
}

export interface DateRange {
  from: string
  /** letzter Tag der Lücke (Nacht von `to` auf den Folgetag) */
  to: string
  nights: number
}

export interface Coverage {
  /** Nächte der Reise (Starttag bis Vortag des Endtags) */
  totalNights: number
  bookedNights: number
  /** Nächte mit Idee/Anfrage, aber ohne Buchung */
  plannedNights: number
  /** Nächte ohne gebuchte Unterkunft, zu Bereichen zusammengefasst */
  gaps: DateRange[]
  /** Nächte mit mehr als einer Buchung */
  doubleBooked: string[]
}

/**
 * Prüft, welche Nächte der Reise abgedeckt sind.
 * Eine Nacht D ist abgedeckt, wenn checkIn <= D < checkOut.
 */
export function coverage(tripStart: string, tripEnd: string, list: Accommodation[]): Coverage {
  const totalNights = Math.max(0, diffDays(tripStart, tripEnd))
  const active = list.filter((a) => a.status !== 'storniert')
  let bookedNights = 0
  let plannedNights = 0
  const uncovered: string[] = []
  const doubleBooked: string[] = []

  for (let i = 0; i < totalNights; i++) {
    const night = addDays(tripStart, i)
    const covering = active.filter((a) => a.checkIn <= night && night < a.checkOut)
    const booked = covering.filter((a) => a.status === 'gebucht').length
    if (booked > 0) bookedNights++
    else {
      uncovered.push(night)
      if (covering.length > 0) plannedNights++
    }
    if (booked > 1) doubleBooked.push(night)
  }

  return { totalNights, bookedNights, plannedNights, gaps: toRanges(uncovered), doubleBooked }
}

/** Fasst aufeinanderfolgende Daten zu Bereichen zusammen. */
export function toRanges(sortedDates: string[]): DateRange[] {
  const ranges: DateRange[] = []
  for (const d of sortedDates) {
    const last = ranges.at(-1)
    if (last && addDays(last.to, 1) === d) {
      last.to = d
      last.nights++
    } else {
      ranges.push({ from: d, to: d, nights: 1 })
    }
  }
  return ranges
}

/** Summe der Preise (ohne Storniertes) in der angegebenen Währung. */
export function totalCost(list: Accommodation[], currency: string): number {
  return list
    .filter((a) => a.status !== 'storniert' && a.price !== null && a.currency === currency)
    .reduce((sum, a) => sum + (a.price ?? 0), 0)
}

/** Gebuchte Unterkünfte, deren kostenlose Stornofrist in den nächsten `withinDays` Tagen endet. */
export function upcomingCancelDeadlines(list: Accommodation[], withinDays = 14, today: Date = new Date()) {
  const t = todayIso(today)
  return list
    .filter((a) => a.status === 'gebucht' && a.cancelUntil && a.cancelUntil >= t)
    .map((a) => ({ accommodation: a, daysLeft: diffDays(t, a.cancelUntil) }))
    .filter((x) => x.daysLeft <= withinDays)
    .sort((x, y) => x.daysLeft - y.daysLeft)
}

/** Sortierung für die Liste: nach Anreise, Storniertes ans Ende. */
export function sortAccommodations(list: Accommodation[]): Accommodation[] {
  return [...list].sort((a, b) => {
    const s = Number(a.status === 'storniert') - Number(b.status === 'storniert')
    return s !== 0 ? s : a.checkIn.localeCompare(b.checkIn)
  })
}
