/** Öffentliche Schnittstelle des Reise-Moduls für andere Module. */
export { tripRepository } from './repository'
export type { Trip } from './types'
export { default as TripContextHeader } from './components/TripContextHeader.vue'
export { default as PersonSelect } from './components/PersonSelect.vue'
export { participantsOf } from './logic'
export { tripDays } from './logic'
