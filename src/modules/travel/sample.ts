import type { SampleTrip } from '@/core/sample'
import { travelRepository } from './repository'
import { emptyLegDraft } from './logic'
import { t } from '@/i18n'

/** Beispielreise: mit dem Auto hin und zurück */
export async function travelSample(s: SampleTrip): Promise<void> {
  const car = { mode: 'auto' as const, distanceKm: 420, consumption: 6.5, fuelPrice: 1.79, tolls: 32, currency: s.currency }
  await travelRepository.createMany(s.tripId, [
    emptyLegDraft({ ...car, direction: 'hin', from: t('München'), to: 'Riva del Garda', date: s.day(0), departTime: '08:00', arriveTime: '13:30', notes: t('Pause am Brenner') }),
    emptyLegDraft({ ...car, direction: 'rueck', from: 'Riva del Garda', to: t('München'), date: s.day(6), departTime: '10:00', arriveTime: '15:30' })
  ])
}
