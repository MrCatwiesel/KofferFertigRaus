import type { TravelDirection, TravelLeg, TravelLegDraft, TravelMode } from './types'
import { t } from '@/i18n'

/** Modus aus der Reise (Feld "Anreise") auf die Etappen-Arten abbilden. */
export function modeFromTripTransport(t: string): TravelMode {
  return (['auto', 'bahn', 'flug', 'bus'] as string[]).includes(t) ? (t as TravelMode) : 'sonstiges'
}

export function emptyLegDraft(over: Partial<TravelLegDraft> = {}): TravelLegDraft {
  return {
    direction: 'hin',
    mode: 'auto',
    from: '',
    to: '',
    date: '',
    departTime: '',
    arriveTime: '',
    distanceKm: null,
    cost: null,
    currency: 'EUR',
    consumption: null,
    fuelPrice: null,
    tolls: null,
    bookingRef: '',
    url: '',
    notes: '',
    ...over
  }
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/**
 * Dauer in Minuten aus Abfahrt und Ankunft (Ortszeit).
 * Liegt die Ankunft vor der Abfahrt, wird der Folgetag angenommen (Nachtzug, Nachtfahrt).
 */
export function durationMinutes(departTime: string, arriveTime: string): number | null {
  if (!TIME_RE.test(departTime) || !TIME_RE.test(arriveTime)) return null
  let d = toMinutes(arriveTime) - toMinutes(departTime)
  if (d < 0) d += 24 * 60
  return d
}

/** "8:05 Std." bzw. "45 Min." */
export function formatDuration(min: number): string {
  if (min < 60) return `${min} Min.`
  return `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')} Std.`
}

/** Spritkosten einer Autoetappe: km × Verbrauch/100 × Preis. */
export function fuelCost(leg: Pick<TravelLeg, 'distanceKm' | 'consumption' | 'fuelPrice'>): number | null {
  if (!leg.distanceKm || !leg.consumption || !leg.fuelPrice) return null
  return Math.round(((leg.distanceKm * leg.consumption) / 100) * leg.fuelPrice * 100) / 100
}

/**
 * Kosten der Etappe: ein eingetragener Preis hat Vorrang.
 * Beim Auto ohne Preis wird aus Sprit und Maut gerechnet.
 */
export function legCost(leg: Pick<TravelLeg, 'mode' | 'cost' | 'distanceKm' | 'consumption' | 'fuelPrice' | 'tolls'>): number | null {
  if (leg.cost !== null) return leg.cost
  if (leg.mode !== 'auto') return null
  const fuel = fuelCost(leg)
  if (fuel === null && !leg.tolls) return null
  return Math.round(((fuel ?? 0) + (leg.tolls ?? 0)) * 100) / 100
}

/**
 * Pausen-Empfehlung für Autoetappen: Faustregel alle 2 Stunden etwa 15–20 Minuten Pause.
 * Liefert die Anzahl empfohlener Pausen.
 */
export function recommendedBreaks(mode: TravelMode, minutes: number | null): number {
  if (mode !== 'auto' || minutes === null) return 0
  return Math.max(0, Math.ceil(minutes / 120) - 1)
}

export interface DirectionSummary {
  legs: number
  distanceKm: number
  /** Summe der Fahrzeiten der Etappen mit Zeiten (ohne Umsteige-/Wartezeiten) */
  travelMinutes: number
  /** Etappen ohne vollständige Zeitangabe */
  legsWithoutTime: number
  cost: number
}

/** Kennzahlen je Richtung; Kosten nur in der angegebenen Währung. */
export function summarize(list: TravelLeg[], direction: TravelDirection, currency: string): DirectionSummary {
  const legs = list.filter((l) => l.direction === direction)
  let travelMinutes = 0
  let legsWithoutTime = 0
  for (const l of legs) {
    const d = durationMinutes(l.departTime, l.arriveTime)
    if (d === null) legsWithoutTime++
    else travelMinutes += d
  }
  return {
    legs: legs.length,
    distanceKm: legs.reduce((s, l) => s + (l.distanceKm ?? 0), 0),
    travelMinutes,
    legsWithoutTime,
    cost: totalCost(legs, currency)
  }
}

export function totalCost(list: TravelLeg[], currency: string): number {
  return Math.round(list.filter((l) => l.currency === currency).reduce((s, l) => s + (legCost(l) ?? 0), 0) * 100) / 100
}

/** Etappen einer Richtung in Reihenfolge. */
export function legsOf(list: TravelLeg[], direction: TravelDirection): TravelLeg[] {
  return list.filter((l) => l.direction === direction).sort((a, b) => a.position - b.position)
}

/**
 * Hinweise auf Lücken: Ziel einer Etappe passt nicht zum Start der nächsten.
 * Liefert die IDs der Etappen, deren Start nicht zum vorherigen Ziel passt.
 */
export function brokenConnections(ordered: TravelLeg[]): string[] {
  const norm = (s: string) => s.trim().toLowerCase()
  const out: string[] = []
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1]
    const cur = ordered[i]
    if (prev.to && cur.from && norm(prev.to) !== norm(cur.from)) out.push(cur.id)
  }
  return out
}

/**
 * Entwürfe für die Rückreise aus der Hinreise: umgekehrte Reihenfolge,
 * Start/Ziel getauscht, Datum = Reiseende, Zeiten und Buchungsdaten leer.
 */
export function reverseLegs(outbound: TravelLeg[], returnDate: string): TravelLegDraft[] {
  return [...outbound]
    .sort((a, b) => b.position - a.position)
    .map((l) =>
      emptyLegDraft({
        direction: 'rueck',
        mode: l.mode,
        from: l.to,
        to: l.from,
        date: returnDate,
        distanceKm: l.distanceKm,
        currency: l.currency,
        consumption: l.consumption,
        fuelPrice: l.fuelPrice,
        tolls: l.tolls,
        // Ticketpreise gelten nicht automatisch für die Rückfahrt
        cost: l.mode === 'auto' ? l.cost : null
      })
    )
}

export function validateLeg(d: TravelLegDraft): Partial<Record<keyof TravelLegDraft, string>> {
  const e: Partial<Record<keyof TravelLegDraft, string>> = {}
  if (!d.from.trim()) e.from = t('Bitte Startort angeben.')
  if (!d.to.trim()) e.to = t('Bitte Zielort angeben.')
  if (d.departTime && !TIME_RE.test(d.departTime)) e.departTime = t('Format HH:MM')
  if (d.arriveTime && !TIME_RE.test(d.arriveTime)) e.arriveTime = t('Format HH:MM')
  for (const k of ['distanceKm', 'cost', 'consumption', 'fuelPrice', 'tolls'] as const) {
    const v = d[k]
    if (v !== null && v < 0) e[k] = t('Darf nicht negativ sein.')
  }
  return e
}

const TRAVELMODE_GOOGLE: Partial<Record<TravelMode, string>> = {
  auto: 'driving',
  bahn: 'transit',
  bus: 'transit',
  fahrrad: 'bicycling'
}
const TRAVELMODE_APPLE: Partial<Record<TravelMode, string>> = {
  auto: 'd',
  bahn: 'r',
  bus: 'r'
}

/** Link zur Routenplanung in Google Maps (öffnet App oder Webseite). */
export function googleMapsUrl(from: string, to: string, mode: TravelMode): string {
  const p = new URLSearchParams({ api: '1', origin: from, destination: to })
  const m = TRAVELMODE_GOOGLE[mode]
  if (m) p.set('travelmode', m)
  return `https://www.google.com/maps/dir/?${p}`
}

/** Link zur Routenplanung in Apple Karten (auf iPad/iPhone direkt in der App). */
export function appleMapsUrl(from: string, to: string, mode: TravelMode): string {
  const p = new URLSearchParams({ saddr: from, daddr: to })
  const m = TRAVELMODE_APPLE[mode]
  if (m) p.set('dirflg', m)
  return `https://maps.apple.com/?${p}`
}
