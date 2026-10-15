import { t } from '@/i18n'
/** Ein Reiseprojekt – der Ausgangspunkt für alle weiteren Module. */
export interface Trip {
  id: string
  title: string
  /** Hauptziel, z. B. "Gardasee, Italien" */
  destination: string
  /** Zielländer (ISO-Codes, z. B. ["AT", "IT"]) – für Reise- und Sicherheitshinweise */
  countries?: string[]
  /** Durchreiseländer (ISO-Codes) – für den Länder-Spickzettel (Vignette, Tempo, Notruf unterwegs) */
  transit?: string[]
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
  /** Eigenes Titelbild (verkleinert); ohne Bild wird eine Landschaft gezeichnet */
  cover?: Blob | null
  /** Ausschnitt des Titelbilds senkrecht in Prozent (0 = oben, 100 = unten) */
  coverY?: number
  /** Abgeschlossen und ins Archiv gelegt (in der Reiseliste eingeklappt) */
  archived?: boolean
  /** Beispielreise aus der Einführung (Hinweis-Leiste mit „Löschen“) */
  sample?: boolean
  /**
   * Teilnehmer-Name → Person beim Abgleich-Server (Personen & Rechte). Verknüpfte Teilnehmer haben private
   * Packliste, Medikamente, Impfungen, Dokumente und Gesundheit (Allergien; standardmäßig für alle freigegeben).
   */
  memberLinks?: Record<string, string>
  /** Unwetterwarnungen: für die Orte der Reise, das ganze Land oder aus; dazu von Hand beobachtete Regionen */
  weatherAlerts?: {
    scope: 'orte' | 'land' | 'aus'
    regions: string[]
    regionNames?: Record<string, string>
  }
  createdAt: string
  updatedAt: string
}

export type TripDraft = Omit<Trip, 'id' | 'createdAt' | 'updatedAt'>

export const TRANSPORT_LABELS: Record<Trip['transport'], string> = {
  auto: t('Auto'),
  bahn: t('Bahn'),
  flug: t('Flug'),
  bus: t('Bus'),
  sonstiges: t('Sonstiges')
}
