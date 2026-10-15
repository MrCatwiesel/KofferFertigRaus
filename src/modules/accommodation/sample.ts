import type { SampleTrip } from '@/core/sample'
import { accommodationRepository } from './repository'
import { emptyAccommodationDraft } from './logic'

/** Beispielreise: eine gebuchte Ferienwohnung */
export async function accommodationSample(s: SampleTrip): Promise<void> {
  const id = await accommodationRepository.create(s.tripId, {
    ...emptyAccommodationDraft(),
    name: 'Ferienwohnung am See',
    type: 'ferienwohnung',
    address: 'Riva del Garda, Italien',
    checkIn: s.day(0),
    checkOut: s.day(6),
    price: 840,
    currency: s.currency,
    status: 'gebucht',
    bookingRef: 'BEISPIEL-123',
    notes: 'Schlüssel im Café nebenan abholen.'
  })
  s.locations.push({ kind: 'accommodation', refId: id, lat: 45.8862, lon: 10.8396, label: 'Riva del Garda' })
}
