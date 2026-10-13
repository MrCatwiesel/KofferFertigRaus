/** Ein Reiseprojekt – der Ausgangspunkt für alle weiteren Module. */
export interface Trip {
  id: string
  title: string
  /** Hauptziel, z. B. "Gardasee, Italien" */
  destination: string
  /** Zielländer (ISO-Codes, z. B. ["AT", "IT"]) – für Reise- und Sicherheitshinweise */
  countries?: string[]
  /** ISO-Datum YYYY-MM-DD */
  startDate: string
  /** ISO-Datum YYYY-MM-DD */
  endDate: string
  travelers: number
  /** Namen der Mitreisenden, z. B. ["Ich", "Anna"]; leer = nicht festgelegt */
  participants: string[]
  /** Gesamtbudget in `currency` */
  budget: number | null
  currency: string
  /** Anreiseart – Detailplanung folgt im Modul "Anreise" */
  transport: 'auto' | 'bahn' | 'flug' | 'bus' | 'sonstiges'
  notes: string
  createdAt: string
  updatedAt: string
}

export type TripDraft = Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>

export const TRANSPORT_LABELS: Record<Trip['transport'], string> = {
  auto: 'Auto',
  bahn: 'Bahn',
  flug: 'Flug',
  bus: 'Bus',
  sonstiges: 'Sonstiges'
}
