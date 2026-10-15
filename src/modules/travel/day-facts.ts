import type { DayFact } from '@/core/registry'
import { MODE, type TravelLeg } from './types'
import { t } from '@/i18n'

const VIA: Record<string, string> = { auto: t('mit dem Auto'), bahn: t('mit der Bahn'), flug: t('mit dem Flugzeug'), bus: t('mit dem Bus'), faehre: t('mit der Fähre'), fahrrad: t('mit dem Fahrrad'), sonstiges: '' }

/** An- und Heimreise an diesem Tag als Sätze für den Tagebuch-Entwurf */
export function travelDayFacts(legs: readonly TravelLeg[], date: string): DayFact[] {
  const today = legs.filter((l) => l.date === date).sort((a, b) => a.direction.localeCompare(b.direction) || a.position - b.position)
  if (!today.length) return []
  const out: DayFact[] = []
  for (const dir of ['hin', 'rueck'] as const) {
    const ls = today.filter((l) => l.direction === dir)
    if (!ls.length) continue
    const parts = ls.map((l) => {
      const way = [l.from && t('von {place}', { place: l.from }), l.to && t('nach {place}', { place: l.to }), VIA[l.mode] ?? MODE[l.mode]?.label ?? ''].filter(Boolean).join(' ')
      const time =
        l.departTime && l.arriveTime ? ' ' + t('({from}–{to} Uhr)', { from: l.departTime, to: l.arriveTime }) : l.departTime ? ' ' + t('(ab {time} Uhr)', { time: l.departTime }) : ''
      return `${way}${time}`
    })
    const head = dir === 'hin' ? t('Anreise') : t('Heimreise')
    out.push({
      order: 10,
      text: t('{head}: {parts}.', { head, parts: parts.join(t(', dann ')) }),
      title: head,
      titleRank: 3,
      ...(dir === 'hin' && ls[ls.length - 1].to ? { location: ls[ls.length - 1].to, locationRank: 2 } : {})
    })
  }
  return out
}
