import { addDays, todayIso } from './dates'
import { newId } from './db'
import { getModules } from './registry'

/**
 * Rahmen der Beispielreise. Sie läuft gerade (vorgestern bis in vier Tagen),
 * damit „Heute“, Tagebuch und Ausgaben schon etwas zeigen.
 * Jedes Modul legt über `sampleData` seine eigenen Beispiel-Einträge an.
 */
export interface SampleTrip {
  tripId: string
  startDate: string
  endDate: string
  today: string
  /** Datum des n-ten Reisetags (0 = Anreisetag) */
  day: (n: number) => string
  participants: string[]
  currency: string
  /** Position eines Beispiel-Eintrags für die Karte (speichert das Karten-Modul) */
  locations: SampleLocation[]
  /** Arbeit, die erst laufen soll, wenn alle Module ihre Einträge angelegt haben */
  after: (fn: () => Promise<void>) => void
}

export interface SampleLocation {
  kind: 'accommodation' | 'activity'
  refId: string
  lat: number
  lon: number
  label: string
}

export function sampleFrame(today: string = todayIso(), tripId: string = newId(), later: (() => Promise<void>)[] = []): SampleTrip {
  const startDate = addDays(today, -2)
  return {
    tripId,
    startDate,
    endDate: addDays(startDate, 6),
    today,
    day: (n) => addDays(startDate, n),
    participants: ['Anna', 'Ben'],
    currency: 'EUR',
    locations: [],
    after: (fn) => void later.push(fn)
  }
}

/**
 * Legt die Beispielreise an und liefert ihre ID.
 * Module in ihrer Reihenfolge – das Reise-Modul (kleinste Nummer) legt die Reise selbst an.
 * Fehler einzelner Module brechen nicht ab: dann fehlt eben dieser Teil.
 */
export async function createSampleTrip(today?: string): Promise<string> {
  const later: (() => Promise<void>)[] = []
  const s = sampleFrame(today, newId(), later)
  for (const m of getModules()) {
    if (!m.sampleData) continue
    try {
      await m.sampleData(s)
    } catch (e) {
      // Ohne die Reise selbst ergibt der Rest keinen Sinn
      if (m.id === 'trip') throw e
      console.warn(`Beispielreise (${m.id}):`, e)
    }
  }
  for (const fn of later) await fn().catch((e) => console.warn('Beispielreise:', e))
  return s.tripId
}
