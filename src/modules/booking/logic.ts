/**
 * Erkannte Buchung → Einträge der App (Unterkunft, Etappen der An-/Rückreise oder Buchungsbeleg in den Dokumenten).
 * Reine Logik (testbar); die Ansicht zeigt die Entwürfe zum Prüfen an.
 */
import type { BookingGuess, LegGuess, StayGuess } from './parse'
import { N_, t, translated } from '@/core/i18n'

export interface TripRef {
  startDate: string
  endDate: string
  currency: string
}

export const MODE_LABEL: Record<LegGuess['mode'], string> = translated({ flug: N_('Flug'), bahn: N_('Bahn'), bus: N_('Bus'), faehre: N_('Fähre'), auto: N_('Auto'), sonstiges: N_('Sonstiges') })

/** Hin- oder Rückreise: näher am Reisebeginn → hin, näher am Ende → zurück */
export function directionOf(date: string, trip: Pick<TripRef, 'startDate' | 'endDate'>): 'hin' | 'rueck' {
  if (!date || !trip.startDate || !trip.endDate) return 'hin'
  return Math.abs(Date.parse(date) - Date.parse(trip.endDate)) < Math.abs(Date.parse(date) - Date.parse(trip.startDate)) ? 'rueck' : 'hin'
}

/** Liegen die erkannten Daten in der Reise? (Hinweis in der Ansicht) */
export function outsideTrip(dates: string[], trip: Pick<TripRef, 'startDate' | 'endDate'>): boolean {
  if (!trip.startDate || !trip.endDate) return false
  const lo = new Date(Date.parse(trip.startDate) - 2 * 86400_000).toISOString().slice(0, 10)
  const hi = new Date(Date.parse(trip.endDate) + 2 * 86400_000).toISOString().slice(0, 10)
  return dates.filter(Boolean).some((d) => d < lo || d > hi)
}

export function stayDraft(s: StayGuess, notes: string) {
  return {
    name: s.name.trim() || t('Unterkunft'),
    type: s.type,
    address: s.address,
    url: s.url,
    checkIn: s.checkIn,
    checkOut: s.checkOut,
    price: s.price,
    currency: s.currency || 'EUR',
    status: 'gebucht' as const,
    bookingRef: s.bookingRef,
    cancelUntil: s.cancelUntil,
    notes
  }
}

export function legDrafts(g: Pick<BookingGuess, 'legs' | 'price' | 'currency' | 'bookingRef'>, trip: TripRef, notes: string) {
  return g.legs.map((l, i) => ({
    direction: directionOf(l.date, trip),
    mode: l.mode,
    from: l.from,
    to: l.to,
    date: l.date,
    departTime: l.departTime,
    arriveTime: l.arriveTime,
    distanceKm: null,
    // Gesamtpreis bei der ersten Etappe, damit er nicht doppelt zählt
    cost: i === 0 ? g.price : null,
    currency: g.currency || trip.currency || 'EUR',
    consumption: null,
    fuelPrice: null,
    tolls: null,
    bookingRef: g.bookingRef,
    url: '',
    notes: [l.number && `${MODE_LABEL[l.mode]} ${l.number}`, i === 0 && g.price !== null && g.legs.length > 1 ? t('Preis gilt für alle Etappen dieser Buchung.') : '', notes].filter(Boolean).join('\n')
  }))
}

/** Kurzer Auszug des Textes für die Notizen (damit man später nachlesen kann) */
export function excerpt(text: string, max = 600): string {
  const t = text.replace(/\n{2,}/g, '\n').trim()
  return t.length > max ? `${t.slice(0, max).trimEnd()} …` : t
}
