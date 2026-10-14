import type { DayFact } from '@/core/registry'
import { formatDistance, formatDuration } from '@/services/tracks'
import type { Route } from './types'
import { locale, t } from '@/core/i18n'

/** Touren des Tages mit Strecke, Höhenmetern, Zeit und höchstem Punkt */
export function routeDayFacts(routes: readonly Pick<Route, 'name' | 'kind' | 'date' | 'stats'>[], date: string): DayFact[] {
  return routes
    .filter((r) => r.date === date)
    .sort((a, b) => (a.kind === b.kind ? b.stats.distance - a.stats.distance : a.kind === 'track' ? -1 : 1))
    .map((r, i) => {
      const s = r.stats
      const parts = [
        formatDistance(s.distance),
        s.ascent ? t('{0} Höhenmeter hinauf', [s.ascent.toLocaleString(locale())]) : '',
        s.duration ? t('{0} unterwegs', [formatDuration(s.duration)]) : '',
        s.maxEle !== null && s.maxEle > 0 ? t('höchster Punkt {0} m', [Math.round(s.maxEle).toLocaleString(locale())]) : ''
      ].filter(Boolean)
      return {
        order: 40,
        text: `${r.kind === 'track' ? 'Tour' : 'Geplante Route'} „${r.name}“: ${parts.join(', ')}.`,
        ...(i === 0 ? { title: r.name, titleRank: r.kind === 'track' ? 1 : 4 } : {})
      }
    })
}
