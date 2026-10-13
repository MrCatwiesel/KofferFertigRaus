/** Öffentliche Schnittstelle des Moduls "Unterkünfte" (z. B. für die Karte). */
export { accommodationRepository } from './repository'
export type { Accommodation } from './types'
export { ACCOMMODATION_TYPE_LABELS, ACCOMMODATION_STATUS } from './types'
export { emptyAccommodationDraft } from './logic'
export type { AccommodationDraft } from './types'
