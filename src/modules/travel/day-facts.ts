import type { DayFact } from '@/core/registry'
import { MODE, type TravelLeg } from './types'

const VIA: Record<string, string> = { auto: 'mit dem Auto', bahn: 'mit der Bahn', flug: 'mit dem Flugzeug', bus: 'mit dem Bus', faehre: 'mit der Fähre', fahrrad: 'mit dem Fahrrad', sonstiges: '' }

/** An- und Heimreise an diesem Tag als Sätze für den Tagebuch-Entwurf */
export function travelDayFacts(legs: readonly TravelLeg[], date: string): DayFact[] {
  const today = legs.filter((l) => l.date === date).sort((a, b) => a.direction.localeCompare(b.direction) || a.position - b.position)
  if (!today.length) return []
  const out: DayFact[] = []
  for (const dir of ['hin', 'rueck'] as const) {
    const ls = today.filter((l) => l.direction === dir)
    if (!ls.length) continue
    const parts = ls.map((l) => {
      const way = [l.from && `von ${l.from}`, l.to && `nach ${l.to}`, VIA[l.mode] ?? MODE[l.mode]?.label ?? ''].filter(Boolean).join(' ')
      const time = l.departTime && l.arriveTime ? ` (${l.departTime}–${l.arriveTime} Uhr)` : l.departTime ? ` (ab ${l.departTime} Uhr)` : ''
      return `${way}${time}`
    })
    const head = dir === 'hin' ? 'Anreise' : 'Heimreise'
    out.push({
      order: 10,
      text: `${head}: ${parts.join(', dann ')}.`,
      title: head,
      titleRank: 3,
      ...(dir === 'hin' && ls[ls.length - 1].to ? { location: ls[ls.length - 1].to, locationRank: 2 } : {})
    })
  }
  return out
}
