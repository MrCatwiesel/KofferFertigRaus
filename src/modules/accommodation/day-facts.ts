import type { DayFact } from '@/core/registry'
import type { Accommodation } from './types'
import { t } from '@/core/i18n'

/** Unterkunft: Ankunft, Übernachtung oder Abreise an diesem Tag */
export function stayDayFacts(stays: readonly Accommodation[], date: string): DayFact[] {
  const booked = stays.filter((s) => s.status === 'gebucht' && s.checkIn && s.checkOut)
  const out: DayFact[] = []
  const leaving = booked.find((s) => s.checkOut === date)
  const arriving = booked.find((s) => s.checkIn === date)
  const staying = booked.find((s) => s.checkIn < date && date < s.checkOut)
  if (leaving && !arriving) out.push({ order: 50, text: t('Abschied von {0}.', [leaving.name]) })
  if (arriving) out.push({ order: 50, text: leaving ? t('Umzug nach {0}.', [arriving.name]) : t('Angekommen in {0}.', [arriving.name]) })
  else if (staying) out.push({ order: 50, text: t('Übernachtung in {0}.', [staying.name]) })
  return out
}
