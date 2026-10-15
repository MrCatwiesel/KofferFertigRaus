import type { DayFact } from '@/core/registry'
import { joinList } from '@/core/format'
import type { Activity } from './types'
import { t } from '@/i18n'

/** Unternehmungen des Tages: erledigte („Unternommen“), sonst geplante („Auf dem Plan“) */
export function activityDayFacts(activities: readonly Activity[], date: string): DayFact[] {
  const day = activities.filter((a) => a.plannedDate === date && a.status !== 'verworfen').sort((a, b) => a.priority - b.priority)
  const done = day.filter((a) => a.status === 'erledigt')
  const list = done.length ? done : day.filter((a) => a.status === 'geplant')
  if (!list.length) return []
  const first = list[0]
  return [
    {
      order: 30,
      text: done.length ? t('Unternommen: {list}.', { list: joinList(list.map((a) => a.title)) }) : t('Auf dem Plan: {list}.', { list: joinList(list.map((a) => a.title)) }),
      title: first.title,
      titleRank: 2,
      ...(first.place && !/^-?\d/.test(first.place) ? { location: first.place.split(',')[0].trim(), locationRank: 3 } : {})
    }
  ]
}
