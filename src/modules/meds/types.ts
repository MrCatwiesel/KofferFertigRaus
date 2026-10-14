import { N_, translated } from '@/core/i18n'
export type MedKind = 'dauer' | 'bedarf' | 'notfall'

/** Ein Medikament oder Artikel der Reiseapotheke. */
export interface Medication {
  id: string
  tripId: string
  name: string
  kind: MedKind
  /** Für wen; leer = für alle */
  person: string
  /** Dosis als Text, z. B. "1 Tablette", "5 ml" */
  dose: string
  /** Einheiten pro Einnahme (für die Mengenberechnung), z. B. 1 */
  unitsPerDose: number | null
  /** Einnahmezeiten "HH:MM" – nur bei Dauermedikation */
  times: string[]
  /** Vorhandene Einheiten (Tabletten, Kapseln …) */
  stockUnits: number | null
  /** Haltbar bis (ISO-Datum) oder leer */
  expiryDate: string
  prescription: boolean
  /** Ins Handgepäck */
  handLuggage: boolean
  /** Kühlen nötig */
  cooling: boolean
  packed: boolean
  notes: string
  /** Freigabe, wenn der Eintrag privat ist (Teilnehmer mit Konto verknüpft): Personen-IDs, '*' = alle */
  sharedWith?: string[]
  createdAt: string
  updatedAt: string
}

export type MedicationDraft = Omit<Medication, 'id' | 'tripId' | 'createdAt' | 'updatedAt'>

export type VaccinationStatus = 'pruefen' | 'geplant' | 'erledigt'

export interface Vaccination {
  id: string
  tripId: string
  name: string
  person: string
  /** Termin oder Datum der letzten Impfung */
  date: string
  /** Schutz gültig bis (ISO-Datum) oder leer */
  validUntil: string
  status: VaccinationStatus
  notes: string
  createdAt: string
  updatedAt: string
}

export type VaccinationDraft = Omit<Vaccination, 'id' | 'tripId' | 'createdAt' | 'updatedAt'>

export const KIND: Record<MedKind, { label: string; icon: string; hint: string }> = translated({
  dauer: { label: N_('Dauermedikation'), icon: 'clock-history', hint: N_('regelmäßig nach Plan') },
  bedarf: { label: N_('Bei Bedarf'), icon: 'bandaid', hint: N_('z. B. Schmerzmittel, Pflaster') },
  notfall: { label: N_('Notfall'), icon: 'exclamation-octagon', hint: N_('z. B. Allergie-Notfallset') }
})

export const VACC_STATUS: Record<VaccinationStatus, { label: string; badge: string }> = translated({
  pruefen: { label: N_('Prüfen'), badge: 'text-bg-warning' },
  geplant: { label: N_('Termin geplant'), badge: 'text-bg-primary' },
  erledigt: { label: N_('Erledigt'), badge: 'text-bg-success' }
})

/**
 * Übliche Bestandteile einer Reiseapotheke (ohne Dosierungen).
 * Auswahl und Mittel mit Arzt oder Apotheke abstimmen.
 */
export const FIRST_AID_KIT: { name: string; kind: MedKind }[] = translated([
  { name: N_('Schmerz- und Fiebermittel'), kind: 'bedarf' },
  { name: N_('Mittel gegen Durchfall'), kind: 'bedarf' },
  { name: N_('Mittel gegen Reiseübelkeit'), kind: 'bedarf' },
  { name: N_('Allergiemittel'), kind: 'bedarf' },
  { name: N_('Wund- und Desinfektionsspray'), kind: 'bedarf' },
  { name: N_('Pflaster & Blasenpflaster'), kind: 'bedarf' },
  { name: N_('Verbandszeug & Mullbinde'), kind: 'bedarf' },
  { name: N_('Fieberthermometer'), kind: 'bedarf' },
  { name: N_('Pinzette / Zeckenzange'), kind: 'bedarf' },
  { name: N_('Insektenschutz & Gel gegen Stiche'), kind: 'bedarf' },
  { name: N_('Sonnenschutz & After-Sun'), kind: 'bedarf' },
  { name: N_('Elektrolyt-Pulver'), kind: 'bedarf' }
])
