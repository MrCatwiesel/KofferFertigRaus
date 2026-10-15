/** Öffentliche Schnittstelle „Gesundheit & Notfall“ (für Dokumente, Sprachführer, Tagesplan). */
export { healthRepository } from './repository'
export type { HealthProfile } from './types'
export { hasAllergies, personLabel } from './logic'
export { useAllergyLink } from './useAllergyLink'
export { default as HealthList } from './components/HealthList.vue'
export { default as DeviceAllergyTakeover } from './components/DeviceAllergyTakeover.vue'
