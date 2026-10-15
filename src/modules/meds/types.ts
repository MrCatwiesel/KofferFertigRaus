import { t } from '@/i18n'
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

export const KIND: Record<MedKind, { label: string; icon: string; hint: string }> = {
  dauer: { label: t('Dauermedikation'), icon: 'clock-history', hint: t('regelmäßig nach Plan') },
  bedarf: { label: t('Bei Bedarf'), icon: 'bandaid', hint: t('z. B. Schmerzmittel, Pflaster') },
  notfall: { label: t('Notfall'), icon: 'exclamation-octagon', hint: t('z. B. Allergie-Notfallset') }
}

export const VACC_STATUS: Record<VaccinationStatus, { label: string; badge: string }> = {
  pruefen: { label: t('Prüfen'), badge: 'text-bg-warning' },
  geplant: { label: t('Termin geplant'), badge: 'text-bg-primary' },
  erledigt: { label: t('Erledigt'), badge: 'text-bg-success' }
}

/**
 * Übliche Bestandteile einer Reiseapotheke (ohne Dosierungen).
 * Auswahl und Mittel mit Arzt oder Apotheke abstimmen.
 */
export const FIRST_AID_KIT: { name: string; kind: MedKind }[] = [
  { name: t('Schmerz- und Fiebermittel'), kind: 'bedarf' },
  { name: t('Mittel gegen Durchfall'), kind: 'bedarf' },
  { name: t('Mittel gegen Reiseübelkeit'), kind: 'bedarf' },
  { name: t('Allergiemittel'), kind: 'bedarf' },
  { name: t('Wund- und Desinfektionsspray'), kind: 'bedarf' },
  { name: t('Pflaster & Blasenpflaster'), kind: 'bedarf' },
  { name: t('Verbandszeug & Mullbinde'), kind: 'bedarf' },
  { name: t('Fieberthermometer'), kind: 'bedarf' },
  { name: t('Pinzette / Zeckenzange'), kind: 'bedarf' },
  { name: t('Insektenschutz & Gel gegen Stiche'), kind: 'bedarf' },
  { name: t('Sonnenschutz & After-Sun'), kind: 'bedarf' },
  { name: 'Elektrolyt-Pulver', kind: 'bedarf' }
]
