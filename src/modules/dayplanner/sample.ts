import type { SampleTrip } from '@/core/sample'
import { weatherRepository } from './repository'

/** Beispielreise: Wetter-Ort festlegen – die Vorhersage lädt der Tagesplan beim Öffnen (veraltet = sofort) */
export async function dayplannerSample(s: SampleTrip): Promise<void> {
  await weatherRepository.put({
    tripId: s.tripId,
    place: { name: 'Riva del Garda', region: 'Trentino-Südtirol, Italien', latitude: 45.8862, longitude: 10.8396 },
    fetchedAt: '',
    days: []
  })
}
