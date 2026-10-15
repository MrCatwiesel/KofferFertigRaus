import { t } from '@/i18n'
import type { AllergenId, CustomAllergen } from '@/modules/sprachfuehrer/public'

/** Erkrankungen, für die der Sprachführer einen fertigen Satz in allen Sprachen hat */
export const CONDITION_IDS = ['bloodThinner', 'diabetes', 'asthma', 'pacemaker'] as const
export type ConditionId = (typeof CONDITION_IDS)[number]

export const CONDITION_LABEL: Record<ConditionId, string> = {
  bloodThinner: t('Nimmt Blutverdünner'),
  diabetes: t('Diabetes'),
  asthma: t('Asthma'),
  pacemaker: t('Herzschrittmacher')
}

/** Blutgruppen (international „O“; auf Deutsch als „0“ angezeigt) */
export const BLOOD_TYPES = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'] as const

/**
 * Gesundheit einer Person auf einer Reise: Allergien, Erkrankungen, Blutgruppe.
 * Eine feste ID je Reise und Person (`${tripId}:gesundheit:${person}`) – so legen zwei Geräte nichts doppelt an.
 * Privat wie Medikamente: ist der Teilnehmer mit einem Konto verknüpft, sehen den Eintrag nur er und `sharedWith`.
 */
export interface HealthProfile {
  id: string
  tripId: string
  /** Teilnehmer-Name; leer = Reise ohne Teilnehmerliste („ich“) */
  person: string
  allergens: AllergenId[]
  /** Eigene Allergien mit selbst eingetragenen Übersetzungen */
  custom: CustomAllergen[]
  conditions: ConditionId[]
  /** '' oder einer aus BLOOD_TYPES */
  bloodType: string
  /** Weitere Erkrankungen (frei, wird nicht übersetzt) */
  otherConditions: string
  /** Hinweise für Helfer, z. B. „Notfallspritze in der Handtasche“ */
  notes: string
  /** Freigabe (Personen-IDs, '*' = alle); Standard: alle Mitreisenden – für den Notfall */
  sharedWith?: string[]
  createdAt: string
  updatedAt: string
}

export type HealthDraft = Omit<HealthProfile, 'id' | 'tripId' | 'person' | 'createdAt' | 'updatedAt'>
