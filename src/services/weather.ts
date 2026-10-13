/**
 * Wetterdienst (Open-Meteo, https://open-meteo.com) – kostenlos, ohne API-Schlüssel.
 * Hinweis: Die freie Nutzung ist für nicht-kommerzielle Zwecke gedacht; bei kommerzieller
 * Nutzung die Bedingungen von Open-Meteo prüfen.
 *
 * Diese Datei enthält nur Netzwerkzugriff und Umwandlung – keine Speicherung.
 */

export interface Place {
  name: string
  /** z. B. "Venetien, Italien" */
  region: string
  latitude: number
  longitude: number
}

export interface DailyWeather {
  /** ISO-Datum */
  date: string
  /** WMO-Wettercode */
  code: number
  tempMax: number
  tempMin: number
  /** Niederschlag in mm */
  precipitation: number
  /** Regenwahrscheinlichkeit in % (oder null, wenn nicht geliefert) */
  precipitationProbability: number | null
  /** max. Windgeschwindigkeit km/h */
  windMax: number | null
}

/** Längster Vorhersagezeitraum, den Open-Meteo liefert. */
export const FORECAST_DAYS = 16

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search'
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'

/** Ort suchen, z. B. "Riva del Garda". */
export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim()
  if (q.length < 2) return []
  const url = `${GEO_URL}?${new URLSearchParams({ name: q, count: '6', language: 'de', format: 'json' })}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Ortssuche fehlgeschlagen (${res.status})`)
  return parsePlaces(await res.json())
}

export function parsePlaces(json: unknown): Place[] {
  const results = (json as { results?: Record<string, unknown>[] })?.results ?? []
  return results
    .filter((r) => typeof r.latitude === 'number' && typeof r.longitude === 'number')
    .map((r) => ({
      name: String(r.name ?? ''),
      region: [r.admin1, r.country].filter(Boolean).join(', '),
      latitude: r.latitude as number,
      longitude: r.longitude as number
    }))
}

/** Tagesvorhersage für einen Ort (heute + bis zu 16 Tage, Ortszeit). */
export async function fetchDailyForecast(latitude: number, longitude: number, signal?: AbortSignal): Promise<DailyWeather[]> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_speed_10m_max',
    timezone: 'auto',
    forecast_days: String(FORECAST_DAYS)
  })
  const res = await fetch(`${FORECAST_URL}?${params}`, { signal })
  if (!res.ok) throw new Error(`Wetter konnte nicht geladen werden (${res.status})`)
  return parseDaily(await res.json())
}

/** Wandelt die Open-Meteo-Antwort (Spalten je Variable) in eine Liste von Tagen um. */
export function parseDaily(json: unknown): DailyWeather[] {
  const d = (json as { daily?: Record<string, unknown[]> })?.daily
  if (!d || !Array.isArray(d.time)) return []
  const num = (arr: unknown[] | undefined, i: number): number | null => {
    const v = arr?.[i]
    return typeof v === 'number' && Number.isFinite(v) ? v : null
  }
  return d.time.map((t, i) => ({
    date: String(t),
    code: num(d.weather_code, i) ?? 0,
    tempMax: num(d.temperature_2m_max, i) ?? 0,
    tempMin: num(d.temperature_2m_min, i) ?? 0,
    precipitation: num(d.precipitation_sum, i) ?? 0,
    precipitationProbability: num(d.precipitation_probability_max, i),
    windMax: num(d.wind_speed_10m_max, i)
  }))
}

export type WeatherKind = 'sonnig' | 'wolkig' | 'nebel' | 'niesel' | 'regen' | 'schnee' | 'gewitter'

/** WMO-Wettercode → Art, Text und Bootstrap-Icon. */
export function describeCode(code: number): { kind: WeatherKind; label: string; icon: string } {
  if (code === 0) return { kind: 'sonnig', label: 'Sonnig', icon: 'sun' }
  if (code <= 2) return { kind: 'sonnig', label: 'Heiter', icon: 'cloud-sun' }
  if (code === 3) return { kind: 'wolkig', label: 'Bewölkt', icon: 'cloud' }
  if (code === 45 || code === 48) return { kind: 'nebel', label: 'Nebel', icon: 'cloud-fog' }
  if (code >= 51 && code <= 57) return { kind: 'niesel', label: 'Nieselregen', icon: 'cloud-drizzle' }
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { kind: 'regen', label: code >= 80 ? 'Regenschauer' : 'Regen', icon: 'cloud-rain' }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { kind: 'schnee', label: 'Schnee', icon: 'cloud-snow' }
  if (code >= 95) return { kind: 'gewitter', label: 'Gewitter', icon: 'cloud-lightning-rain' }
  return { kind: 'wolkig', label: 'Wechselhaft', icon: 'cloud-sun' }
}

// ---------------------------------------------------------------- Aussicht für einen Reisezeitraum

const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive'

/** Tatsächliches Wetter vergangener Tage (Open-Meteo-Archiv, ERA5) */
export async function fetchPastDays(latitude: number, longitude: number, start: string, end: string, signal?: AbortSignal): Promise<DailyWeather[]> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    start_date: start,
    end_date: end,
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
    timezone: 'auto'
  })
  const res = await fetch(`${ARCHIVE_URL}?${params}`, { signal })
  if (!res.ok) throw new Error(`Wetterarchiv nicht erreichbar (${res.status})`)
  return parseDaily(await res.json())
}

/** Zusammenfassung: Was erwartet uns? */
export interface WeatherOutlook {
  /** Vorhersage (Reise beginnt in ≤ 16 Tagen) oder Wetter derselben Tage der letzten Jahre */
  source: 'vorhersage' | 'vorjahre'
  years: number[]
  minTemp: number
  maxTemp: number
  /** Anteil der Tage mit ≥ 1 mm Niederschlag (0–1) */
  rainShare: number
  /** Tage mit Schnee (Wettercode) */
  snow: boolean
  /** Tage mit Wind ≥ 50 km/h */
  windy: boolean
  /** Anzahl ausgewerteter Tage */
  days: number
}

const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86])

export function summarizeOutlook(days: DailyWeather[], source: WeatherOutlook['source'], years: number[] = []): WeatherOutlook | null {
  if (!days.length) return null
  return {
    source,
    years,
    minTemp: Math.round(Math.min(...days.map((d) => d.tempMin))),
    maxTemp: Math.round(Math.max(...days.map((d) => d.tempMax))),
    rainShare: days.filter((d) => d.precipitation >= 1).length / days.length,
    snow: days.some((d) => SNOW_CODES.has(d.code)),
    windy: days.some((d) => (d.windMax ?? 0) >= 50),
    days: days.length
  }
}

/** Datum um Jahre verschieben (ISO) */
const minusYears = (iso: string, n: number) => `${Number(iso.slice(0, 4)) - n}${iso.slice(4)}`.replace(/-02-29$/, '-02-28')

/**
 * Aussicht für die Reise: Vorhersage, wenn die Reise innerhalb der Vorhersage liegt, sonst
 * das Wetter derselben Tage der letzten drei Jahre (gibt ein gutes Gefühl für Temperaturen und Regen).
 */
export async function fetchOutlook(latitude: number, longitude: number, start: string, end: string, today: string): Promise<WeatherOutlook | null> {
  const horizon = new Date(`${today}T12:00:00Z`)
  horizon.setUTCDate(horizon.getUTCDate() + FORECAST_DAYS - 1)
  if (end <= horizon.toISOString().slice(0, 10) && end >= today) {
    const days = (await fetchDailyForecast(latitude, longitude)).filter((d) => d.date >= start && d.date <= end)
    if (days.length) return summarizeOutlook(days, 'vorhersage')
  }
  // Längere Reisen auf 21 Tage begrenzen (Anfragegröße), das reicht für die Packliste
  const endCut = new Date(Math.min(Date.parse(`${end}T12:00:00Z`), Date.parse(`${start}T12:00:00Z`) + 20 * 86400_000)).toISOString().slice(0, 10)
  const thisYear = Number(today.slice(0, 4))
  const years: number[] = []
  const all: DailyWeather[] = []
  for (let n = 1; n <= 3; n++) {
    let s = minusYears(start, n)
    let e = minusYears(endCut, n)
    // Reise im nächsten Jahr: „Vorjahre“ relativ zum heutigen Jahr
    const shift = Number(start.slice(0, 4)) - thisYear
    if (shift > 0) {
      s = minusYears(s, shift)
      e = minusYears(e, shift)
    }
    try {
      all.push(...(await fetchPastDays(latitude, longitude, s, e)))
      years.push(Number(s.slice(0, 4)))
    } catch {
      /* ein Jahr fehlt – die anderen reichen */
    }
  }
  return summarizeOutlook(all, 'vorjahre', years.sort())
}
