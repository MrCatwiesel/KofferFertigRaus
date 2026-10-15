/** Öffentliche Schnittstelle des Länder-Spickzettels (z. B. Notrufnummern für die Notfall-Seite). */
export { emergencyRows, mainEmergency } from './logic'
export type { EmergencyRow } from './logic'
import { FACTS } from './data'
import type { CountryFacts } from './types'
export type { CountryFacts }
export const countryFacts = (code: string): CountryFacts | undefined => FACTS[code]
