import type { DayFact } from '@/core/registry'
import type { Accommodation } from './types'

/** Unterkunft: Ankunft, Übernachtung oder Abreise an diesem Tag */
export function stayDayFacts(stays: readonly Accommodation[], date: string): DayFact[] {
  const booked = stays.filter((s) => s.status === 'gebucht' && s.checkIn && s.checkOut)
  const out: DayFact[] = []
  const leaving = booked.find((s) => s.checkOut === date)
  const arriving = booked.find((s) => s.checkIn === date)
  const staying = booked.find((s) => s.checkIn < date && date < s.checkOut)
  if (leaving && !arriving) out.push({ order: 50, text: `Abschied von ${leaving.name}.` })
  if (arriving) out.push({ order: 50, text: `${leaving ? 'Umzug nach' : 'Angekommen in'} ${arriving.name}.` })
  else if (staying) out.push({ order: 50, text: `Übernachtung in ${staying.name}.` })
  return out
}
