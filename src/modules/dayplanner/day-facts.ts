import type { DayFact } from '@/core/registry'
import { describeCode, type DailyWeather } from '@/services/weather'
import { intlLocale } from '@/i18n'

/** Wetter des Tages aus der zuletzt geladenen Vorhersage (nur, wenn der Tag darin enthalten ist) */
export function weatherDayFacts(days: readonly DailyWeather[] | undefined, date: string): DayFact[] {
  const w = days?.find((d) => d.date === date)
  if (!w) return []
  const t = (v: number) => Math.round(v).toLocaleString(intlLocale())
  const rain = w.precipitation >= 1 ? `, ${w.precipitation.toLocaleString(intlLocale(), { maximumFractionDigits: 0 })} mm Regen` : ''
  return [{ order: 20, text: `Wetter: ${describeCode(w.code).label}, ${t(w.tempMin)} bis ${t(w.tempMax)} °C${rain}.` }]
}
