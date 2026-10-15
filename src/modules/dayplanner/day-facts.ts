import type { DayFact } from '@/core/registry'
import { describeCode, type DailyWeather } from '@/services/weather'
import { t, intlLocale } from '@/i18n'

/** Wetter des Tages aus der zuletzt geladenen Vorhersage (nur, wenn der Tag darin enthalten ist) */
export function weatherDayFacts(days: readonly DailyWeather[] | undefined, date: string): DayFact[] {
  const w = days?.find((d) => d.date === date)
  if (!w) return []
  const deg = (v: number) => Math.round(v).toLocaleString(intlLocale())
  const params = { weather: describeCode(w.code).label, min: deg(w.tempMin), max: deg(w.tempMax) }
  return [
    {
      order: 20,
      text:
        w.precipitation >= 1
          ? t('Wetter: {weather}, {min} bis {max} °C, {rain} mm Regen.', { ...params, rain: w.precipitation.toLocaleString(intlLocale(), { maximumFractionDigits: 0 }) })
          : t('Wetter: {weather}, {min} bis {max} °C.', params)
    }
  ]
}
