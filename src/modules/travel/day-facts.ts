import type { DayFact } from '@/core/registry'
import { MODE, type TravelLeg } from './types'
import { N_, t, translated } from '@/core/i18n'

const VIA: Record<string, string> = translated({ auto: N_('mit dem Auto'), bahn: N_('mit der Bahn'), flug: N_('mit dem Flugzeug'), bus: N_('mit dem Bus'), faehre: N_('mit der Fähre'), fahrrad: N_('mit dem Fahrrad'), sonstiges: '' })

/** An- und Heimreise an diesem Tag als Sätze für den Tagebuch-Entwurf */
export function travelDayFacts(legs: readonly TravelLeg[], date: string): DayFact[] {
  const today = legs.filter((l) => l.date === date).sort((a, b) => a.direction.localeCompare(b.direction) || a.position - b.position)
  if (!today.length) return []
  const out: DayFact[] = []
  for (const dir of ['hin', 'rueck'] as const) {
    const ls = today.filter((l) => l.direction === dir)
    if (!ls.length) continue
    const parts = ls.map((l) => {
      const way = [l.from && t('von {0}', [l.from]), l.to && t('nach {0}', [l.to]), VIA[l.mode] ?? MODE[l.mode]?.label ?? ''].filter(Boolean).join(' ')
      const time = l.departTime && l.arriveTime ? t(' ({0}–{1} Uhr)', [l.departTime, l.arriveTime]) : l.departTime ? t(' (ab {0} Uhr)', [l.departTime]) : ''
      return `${way}${time}`
    })
    const head = dir === 'hin' ? t('Anreise') : t('Heimreise')
    out.push({
      order: 10,
      text: `${head}: ${parts.join(t(', dann '))}.`,
      title: head,
      titleRank: 3,
      ...(dir === 'hin' && ls[ls.length - 1].to ? { location: ls[ls.length - 1].to, locationRank: 2 } : {})
    })
  }
  return out
}
