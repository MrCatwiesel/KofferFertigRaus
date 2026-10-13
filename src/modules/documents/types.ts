export type DocType =
  | 'ausweis'
  | 'reisepass'
  | 'visum'
  | 'fuehrerschein'
  | 'fahrzeug'
  | 'versicherung'
  | 'ticket'
  | 'buchung'
  | 'gesundheit'
  | 'sonstiges'

export type DocStatus = 'fehlt' | 'beantragt' | 'vorhanden'

/** Ein Reisedokument (Ausweis, Visum, Versicherung, Ticket …). */
export interface TravelDocument {
  id: string
  tripId: string
  type: DocType
  title: string
  /** Für wen; leer = für alle */
  person: string
  /** Dokument-, Policen- oder Buchungsnummer (bleibt nur auf diesem Gerät) */
  number: string
  /** Gültig bis (ISO-Datum) oder leer */
  validUntil: string
  status: DocStatus
  /** Foto/Kopie digital abgelegt (z. B. in der Fotos- oder Dateien-App) */
  hasCopy: boolean
  /** Eingepackt / dabei */
  packed: boolean
  notes: string
  /** Automatisch angelegt, z. B. „aa:AT:einreise“ (Reisehinweise) – wird dann bei Änderungen aktualisiert */
  source?: string
  createdAt: string
  updatedAt: string
}

export type TravelDocumentDraft = Omit<TravelDocument, 'id' | 'tripId' | 'createdAt' | 'updatedAt'>

/** Notfallnummer für die Reise (Versicherung, Botschaft, Unterkunft …). */
export interface EmergencyContact {
  id: string
  tripId: string
  label: string
  phone: string
  notes: string
  /** Automatisch angelegt, z. B. „aa:AT:vertretung:300001“ (Botschaft) – wird bei Änderungen aktualisiert */
  source?: string
  createdAt: string
  updatedAt: string
}

export type EmergencyContactDraft = Omit<EmergencyContact, 'id' | 'tripId' | 'createdAt' | 'updatedAt' | 'source'>

export const DOC_TYPE: Record<DocType, { label: string; icon: string }> = {
  ausweis: { label: 'Personalausweis', icon: 'person-vcard' },
  reisepass: { label: 'Reisepass', icon: 'passport' },
  visum: { label: 'Visum / Einreise', icon: 'globe2' },
  fuehrerschein: { label: 'Führerschein', icon: 'car-front' },
  fahrzeug: { label: 'Fahrzeugpapiere', icon: 'file-earmark-text' },
  versicherung: { label: 'Versicherung', icon: 'shield-check' },
  ticket: { label: 'Ticket', icon: 'ticket-perforated' },
  buchung: { label: 'Buchung', icon: 'receipt' },
  gesundheit: { label: 'Gesundheit', icon: 'heart-pulse' },
  sonstiges: { label: 'Sonstiges', icon: 'file-earmark' }
}

export const DOC_STATUS: Record<DocStatus, { label: string; badge: string }> = {
  fehlt: { label: 'Fehlt', badge: 'text-bg-danger' },
  beantragt: { label: 'Beantragt', badge: 'text-bg-warning' },
  vorhanden: { label: 'Vorhanden', badge: 'text-bg-success' }
}

/** Allgemeine Notrufnummern, die immer angezeigt werden. */
export const STANDARD_NUMBERS = [
  { label: 'Notruf in der EU', phone: '112', note: 'Polizei, Feuerwehr, Rettung – in allen EU-Ländern' },
  { label: 'Sperr-Notruf (Karten, Handy)', phone: '+49116116', note: 'Bank- und Kreditkarten sperren, aus dem Ausland mit +49' }
]
