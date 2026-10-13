import type { TripDraft } from './types'
import { DAY_MS, toUtcDay } from '../../core/dates'

// Formatierung liegt im Kern; hier weitergereicht, damit bestehende Imports funktionieren.
export { formatDate, formatMoney } from '../../core/format'

/** Leerer Entwurf für das Formular "Neue Reise". */
export function emptyTripDraft(): TripDraft {
  return {
    title: '',
    destination: '',
    countries: [],
    startDate: '',
    endDate: '',
    travelers: 2,
    participants: [],
    budget: null,
    currency: 'EUR',
    transport: 'auto',
    notes: ''
  }
}

/** Anzahl Reisetage inkl. An- und Abreisetag. */
export function tripDays(startDate: string, endDate: string): number {
  return Math.round((toUtcDay(endDate) - toUtcDay(startDate)) / DAY_MS) + 1
}

/** Tage bis zum Reisebeginn (negativ = Reise läuft oder ist vorbei). */
export function daysUntil(startDate: string, today: Date = new Date()): number {
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((toUtcDay(startDate) - t) / DAY_MS)
}

export type TripPhase = 'planung' | 'unterwegs' | 'vorbei'

export function tripPhase(startDate: string, endDate: string, today: Date = new Date()): TripPhase {
  if (daysUntil(startDate, today) > 0) return 'planung'
  if (daysUntil(endDate, today) >= 0) return 'unterwegs'
  return 'vorbei'
}

/** Budget pro Person und Tag, oder null wenn kein Budget gesetzt ist. */
export function budgetPerPersonDay(
  draft: Pick<TripDraft, 'budget' | 'travelers' | 'startDate' | 'endDate'> & Partial<Pick<TripDraft, 'participants'>>
): number | null {
  // Personen: Anzahl Reisende, sonst Länge der Teilnehmerliste (ältere Datensätze haben nicht immer beides)
  const persons = Number(draft.travelers) || draft.participants?.length || 0
  const days = tripDays(draft.startDate, draft.endDate)
  if (!draft.budget || persons < 1 || !(days > 0)) return null
  return draft.budget / persons / days
}

/** Teilnehmer einer Reise – auch für ältere Datensätze ohne das Feld. */
export function participantsOf(trip: Pick<TripDraft, 'participants'> | undefined | null): string[] {
  return trip?.participants ?? []
}

/** Bereinigt die Teilnehmerliste: getrimmt, ohne Leere und ohne Doppelte (Groß-/Kleinschreibung egal). */
export function cleanParticipants(names: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const n of names) {
    const t = n.trim()
    if (!t || seen.has(t.toLowerCase())) continue
    seen.add(t.toLowerCase())
    out.push(t)
  }
  return out
}

/** Prüft einen Entwurf und liefert Fehlermeldungen je Feld. */
export function validateTrip(draft: TripDraft): Partial<Record<keyof TripDraft, string>> {
  const errors: Partial<Record<keyof TripDraft, string>> = {}
  if (!draft.title.trim()) errors.title = 'Bitte einen Namen für die Reise angeben.'
  if (!draft.destination.trim()) errors.destination = 'Bitte ein Reiseziel angeben.'
  if (!draft.startDate) errors.startDate = 'Bitte ein Startdatum wählen.'
  if (!draft.endDate) errors.endDate = 'Bitte ein Enddatum wählen.'
  if (draft.startDate && draft.endDate && draft.endDate < draft.startDate) {
    errors.endDate = 'Das Ende liegt vor dem Start.'
  }
  if (!Number.isInteger(draft.travelers) || draft.travelers < 1) {
    errors.travelers = 'Mindestens eine reisende Person.'
  }
  if (draft.budget !== null && draft.budget < 0) errors.budget = 'Budget darf nicht negativ sein.'
  const names = (draft.participants ?? []).map((n) => n.trim().toLowerCase()).filter(Boolean)
  if (new Set(names).size !== names.length) errors.participants = 'Jeder Name nur einmal.'
  return errors
}

/** Kurzer Stand für den Kopf der Reiseseite: „noch 12 Tage“, „Tag 2 von 5“, „vor 3 Wochen“ */
export function tripStatusText(startDate: string, endDate: string, today: Date = new Date()): string {
  const until = daysUntil(startDate, today)
  if (until > 1) return `noch ${until} Tage`
  if (until === 1) return 'morgen geht es los'
  const total = tripDays(startDate, endDate)
  const since = -daysUntil(endDate, today)
  if (since <= 0) return until === 0 ? `heute geht es los · ${total} Tage` : `Tag ${1 - until} von ${total}`
  if (since === 1) return 'gestern zurückgekommen'
  if (since < 14) return `vor ${since} Tagen`
  if (since < 60) return `vor ${Math.round(since / 7)} Wochen`
  if (since < 365) return `vor ${Math.round(since / 30)} Monaten`
  const y = Math.round(since / 365)
  return y === 1 ? 'vor einem Jahr' : `vor ${y} Jahren`
}

/** Bereich der Reiseseite, der zum Datum passt */
export function defaultTripTab(t: { startDate: string; endDate: string; archived?: boolean }, today: Date = new Date()): 'planung' | 'unterwegs' | 'danach' | 'teilen' {
  if (t.archived) return 'teilen'
  const p = tripPhase(t.startDate, t.endDate, today)
  return p === 'vorbei' ? 'danach' : p
}
