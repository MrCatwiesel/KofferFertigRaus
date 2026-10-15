import type { SampleTrip } from '@/core/sample'
import { placeRepository } from './repository'

/** Beispielreise: die Orte, die Unterkünfte und Unternehmungen gemeldet haben, auf die Karte setzen */
export async function mapSample(s: SampleTrip): Promise<void> {
  s.after(async () => {
    for (const l of s.locations) await placeRepository.set(s.tripId, l.kind, l.refId, l.lat, l.lon, l.label)
  })
}
