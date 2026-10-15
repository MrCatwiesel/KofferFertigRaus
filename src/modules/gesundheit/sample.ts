import type { SampleTrip } from '@/core/sample'
import { emptyDraft } from './logic'
import { healthRepository } from './repository'

/** Beispielreise: Anna hat eine Erdnussallergie, Ben nimmt Blutverdünner */
export async function healthSample(s: SampleTrip): Promise<void> {
  const [anna, ben] = s.participants
  await healthRepository.save(s.tripId, anna, { ...emptyDraft(), allergens: ['peanuts'], bloodType: 'A+', notes: '' })
  await healthRepository.save(s.tripId, ben, { ...emptyDraft(), conditions: ['bloodThinner'], bloodType: 'O+' })
}
