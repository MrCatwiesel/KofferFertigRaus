import type { SampleTrip } from '@/core/sample'
import { tripRepository } from './repository'
import { emptyTripDraft } from './logic'

/** Beispielreise: die Reise selbst */
export async function tripSample(s: SampleTrip): Promise<void> {
  await tripRepository.createWithId(s.tripId, {
    ...emptyTripDraft(),
    title: 'Beispiel: Gardasee',
    destination: 'Riva del Garda, Gardasee',
    countries: ['IT'],
    startDate: s.startDate,
    endDate: s.endDate,
    travelers: s.participants.length,
    participants: [...s.participants],
    budget: 1800,
    currency: s.currency,
    transport: 'auto',
    notes: 'Eine Beispielreise zum Ausprobieren – ändere ruhig alles. Löschen: oben auf der Reiseseite „Beispielreise löschen“.',
    sample: true
  })
}
