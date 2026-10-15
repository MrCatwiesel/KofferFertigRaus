import type { SampleTrip } from '@/core/sample'
import { accommodationRepository } from './repository'
import { emptyAccommodationDraft } from './logic'
import { t } from '@/i18n'

/** Beispielreise: eine gebuchte Ferienwohnung */
export async function accommodationSample(s: SampleTrip): Promise<void> {
  const id = await accommodationRepository.create(s.tripId, {
    ...emptyAccommodationDraft(),
    name: t('Ferienwohnung am See'),
    type: 'ferienwohnung',
    address: t('Riva del Garda, Italien'),
    checkIn: s.day(0),
    checkOut: s.day(6),
    price: 840,
    currency: s.currency,
    status: 'gebucht',
    bookingRef: 'BEISPIEL-123',
    notes: t('Schlüssel im Café nebenan abholen.')
  })
  s.locations.push({ kind: 'accommodation', refId: id, lat: 45.8862, lon: 10.8396, label: 'Riva del Garda' })
}
