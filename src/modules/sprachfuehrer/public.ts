/** Öffentliche Schnittstelle des Sprachführers (Allergene, Sätze, Sprachen – z. B. für Gesundheit & Notfall). */
export { ALLERGEN_GROUPS, ALLERGEN_IDS, ALLERGEN_SOURCE, SOURCE } from './phrases'
export type { AllergenId, PhraseId } from './phrases'
export { LANGUAGE_OF_COUNTRY, allergyCard, languageName, matchAllergen, tripLanguages } from './logic'
export type { PhraseLanguage } from './languages'
export type { CustomAllergen } from './settings'
export { clearDeviceAllergens, loadAllergens, loadCustomAllergens } from './settings'
/** Sätze aller Sprachen – groß, daher erst bei Bedarf laden */
export const loadLanguages = () => import('./languages').then((m) => m.LANGUAGES)
