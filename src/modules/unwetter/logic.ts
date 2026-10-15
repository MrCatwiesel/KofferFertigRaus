/** Reine Funktionen der Unwetterwarnungen (ohne Datenbank, ohne Vue). */
import { addDays } from '@/core/dates'
import { typeLabel, type AlertScope, type WarningCache, type Watch, type WeatherAlertSettings, type WeatherWarning } from './types'
import { t, tn, intlLocale, language } from '@/i18n'

export const DEFAULT_SETTINGS: WeatherAlertSettings = { scope: 'orte', regions: [] }

export function settingsOf(trip: { weatherAlerts?: WeatherAlertSettings }): WeatherAlertSettings {
  const s = trip.weatherAlerts
  const scope: AlertScope = s?.scope === 'land' || s?.scope === 'aus' ? s.scope : 'orte'
  return { scope, regions: Array.isArray(s?.regions) ? s.regions : [], regionNames: s?.regionNames ?? {} }
}

/** Warnungen werden vom dritten Tag vor der Reise bis zu ihrem Ende automatisch geholt */
export function inWatchWindow(trip: { startDate: string; endDate: string }, today: string): boolean {
  if (!trip.startDate || !trip.endDate) return false
  return today >= addDays(trip.startDate, -3) && today <= trip.endDate
}

/**
 * Ortsnamen aus einer Adresse: „Fusch 12, Bezirk Zell am See, Salzburg, 5672, Österreich“
 * → [„Bezirk Zell am See“, „Salzburg“] (ohne Hausnummern, Postleitzahlen und Ländernamen).
 */
export function namesFromAddress(text: string, skip: Set<string>): string[] {
  return String(text ?? '')
    .split(/[,;\n]/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 3 && !/\d/.test(p) && !skip.has(p.toLowerCase()))
}

export interface WatchSources {
  destination: string
  countryNames: string[]
  /** Verortete Orte der Reise (Unterkünfte, Unternehmungen) */
  places: { lat: number; lon: number; label: string }[]
  /** Wetter-Ort des Tagesplaners */
  weatherPlace?: { name: string; region: string; latitude: number; longitude: number } | null
  /** Adressen der Unterkünfte (auch ohne Ort auf der Karte) */
  addresses: string[]
}

/** Was der Server zum Zuordnen der Warnungen braucht */
export function buildWatch(settings: WeatherAlertSettings, src: WatchSources): Watch {
  const skip = new Set(src.countryNames.map((n) => n.toLowerCase()))
  const points: [number, number][] = []
  const names = new Set<string>()
  const addPoint = (lat: number, lon: number) => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return
    // auf etwa 1 km gerundet – mehr braucht es nicht, und gleiche Orte zählen nur einmal
    const p: [number, number] = [Math.round(lat * 100) / 100, Math.round(lon * 100) / 100]
    if (!points.some((q) => q[0] === p[0] && q[1] === p[1])) points.push(p)
  }
  for (const pl of src.places) {
    addPoint(pl.lat, pl.lon)
    for (const n of namesFromAddress(pl.label, skip)) names.add(n)
  }
  const wp = src.weatherPlace
  if (wp) {
    addPoint(wp.latitude, wp.longitude)
    for (const n of [wp.name, ...namesFromAddress(wp.region, skip)]) if (n && !skip.has(n.toLowerCase())) names.add(n)
  }
  for (const n of namesFromAddress(src.destination, skip)) names.add(n)
  for (const a of src.addresses) for (const n of namesFromAddress(a, skip)) names.add(n)
  return { scope: settings.scope, points: points.slice(0, 200), names: [...names].slice(0, 200), regions: settings.regions.slice(0, 100) }
}

/** Noch nicht abgelaufen */
export const isCurrent = (w: WeatherWarning, now = Date.now()) => !w.expires || Date.parse(w.expires) > now

/** Warnungen für die Reise (passend und aktuell), höchste Stufe zuerst */
export function relevantWarnings(cache: WarningCache | null | undefined, now = Date.now()): (WeatherWarning & { country: string })[] {
  if (!cache) return []
  return cache.countries
    .flatMap((c) => c.warnings.map((w) => ({ ...w, country: c.country })))
    .filter((w) => w.match && isCurrent(w, now))
    .sort((a, b) => b.level - a.level || String(a.onset).localeCompare(String(b.onset)))
}

/** Weitere Warnungen im Land (nicht zugeordnet) */
export function otherWarnings(cache: WarningCache | null | undefined, now = Date.now()): (WeatherWarning & { country: string })[] {
  if (!cache) return []
  return cache.countries.flatMap((c) => c.warnings.filter((w) => !w.match && isCurrent(w, now)).map((w) => ({ ...w, country: c.country })))
}

const LEVEL_WORD: Record<number, string> = { 2: t('Gelb'), 3: t('Orange'), 4: t('Rot') }

/** Kurzfassung für die Reiseseite */
export function summaryText(cache: WarningCache | null | undefined, now = Date.now()): string {
  const list = relevantWarnings(cache, now)
  if (!list.length) return t('Keine Warnungen für eure Orte')
  const top = list[0]
  const types = [...new Set(list.filter((w) => w.level === top.level).map(typeLabel))].slice(0, 2).join(', ')
  return `⚠️ ${tn(list.length, '1 Warnung', '{n} Warnungen')} · ${LEVEL_WORD[top.level] ?? ''}: ${types}`
}

/**
 * „Do 15.10. 14:00“ in der Zeitzone des Geräts (unterwegs stellt sich das iPad selbst auf die Ortszeit um).
 * `timeZone` nur für Tests.
 */
export function localWhen(iso: string, timeZone?: string): string {
  const t = Date.parse(iso)
  if (!iso || Number.isNaN(t)) return ''
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone })
      .formatToParts(new Date(t))
      .map((p) => [p.type, p.value])
  )
  if (language() !== 'de') return `${parts.weekday} ${parts.day}/${parts.month} ${parts.hour}:${parts.minute}`
  return `${String(parts.weekday).replace('.', '')} ${parts.day}.${parts.month}. ${parts.hour}:${parts.minute}`
}

/** „Do 15.10. 14:00 – 22:00“ bzw. „Do 15.10. 14:00 – Fr 16.10. 06:00“ */
export function period(onset: string, expires: string, timeZone?: string): string {
  const a = localWhen(onset, timeZone)
  const b = localWhen(expires, timeZone)
  if (!a) return b ? t('bis {time}', { time: b }) : ''
  if (!b) return t('ab {time}', { time: a })
  const day = (s: string) => s.slice(0, s.lastIndexOf(' '))
  return day(a) === day(b) ? `${a} – ${b.slice(b.lastIndexOf(' ') + 1)}` : `${a} – ${b}`
}

/** Betrifft die Warnung diesen Tag (YYYY-MM-DD, Zeitzone des Geräts)? */
export function overlapsDay(w: WeatherWarning, day: string): boolean {
  const [y, m, d] = day.split('-').map(Number)
  const start = new Date(y, m - 1, d).getTime()
  const end = new Date(y, m - 1, d + 1).getTime()
  const on = Date.parse(w.onset) || 0
  const off = Date.parse(w.expires) || Infinity
  return on < end && off > start
}

/** Läuft die Warnung gerade? */
export const isActiveNow = (w: WeatherWarning, now = Date.now()) => (!w.onset || Date.parse(w.onset) <= now) && isCurrent(w, now)

/** Region beobachten bzw. nicht mehr beobachten */
export function toggleRegion(settings: WeatherAlertSettings, code: string, name: string): WeatherAlertSettings {
  const has = settings.regions.includes(code)
  const regionNames = { ...(settings.regionNames ?? {}) }
  if (has) delete regionNames[code]
  else regionNames[code] = name
  return { ...settings, regions: has ? settings.regions.filter((r) => r !== code) : [...settings.regions, code], regionNames }
}
