import type { DayFact } from '@/core/registry'
import { describeCode, type DailyWeather } from '@/services/weather'
import { locale, t } from '@/core/i18n'

/** Wetter des Tages aus der zuletzt geladenen Vorhersage (nur, wenn der Tag darin enthalten ist) */
export function weatherDayFacts(days: readonly DailyWeather[] | undefined, date: string): DayFact[] {
  const w = days?.find((d) => d.date === date)
  if (!w) return []
  const num = (v: number) => Math.round(v).toLocaleString(locale())
  const rain = w.precipitation >= 1 ? t(', {0} mm Regen', [w.precipitation.toLocaleString(locale(), { maximumFractionDigits: 0 })]) : ''
  return [{ order: 20, text: t('Wetter: {0}, {1} bis {2} °C{3}.', [describeCode(w.code).label, num(w.tempMin), num(w.tempMax), rain]) }]
}
