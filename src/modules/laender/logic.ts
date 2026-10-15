import { intlLocale, t } from '@/i18n'
import { countryName, flag } from '@/core/countries'
import { FACTS } from './data'
import type { CountryFacts, DaylightRule, Emergency, SheetCountry, TipStyle, TollKind, WaterSafety } from './types'

export function factsOf(code: string): CountryFacts | null {
  return FACTS[code] ?? null
}

/** Zielländer, dann Durchreiseländer – ohne Deutschland und ohne doppelte */
export function sheetCountries(trip: { countries?: string[]; transit?: string[] } | undefined): SheetCountry[] {
  const out: SheetCountry[] = []
  const seen = new Set<string>(['DE'])
  for (const c of trip?.countries ?? []) if (!seen.has(c)) (seen.add(c), out.push({ code: c, transit: false }))
  for (const c of trip?.transit ?? []) if (!seen.has(c)) (seen.add(c), out.push({ code: c, transit: true }))
  return out
}

// ---------------------------------------------------------------- Strom

export type PlugFit = 'passt' | 'euro' | 'adapter'

/** Passen deutsche Stecker? Schuko (Typ F) passt in E und F, der flache Eurostecker (Typ C) zusätzlich in C, J, K, L, N, H */
export function plugFit(plugs: string): PlugFit {
  const types = plugs.split(' ')
  if (types.some((x) => x === 'E' || x === 'F')) return 'passt'
  if (types.some((x) => 'CJKLNH'.includes(x))) return 'euro'
  return 'adapter'
}

export function plugText(plugs: string): string {
  switch (plugFit(plugs)) {
    case 'passt':
      return t('Deutsche Stecker passen')
    case 'euro':
      return t('Flache Eurostecker passen, für Schuko-Stecker einen Adapter mitnehmen')
    default:
      return t('Adapter nötig (Typ {types})', { types: plugs.split(' ').join('/') })
  }
}

/** Hinweis bei Netzen unter 200 Volt */
export function voltageHint(volt: number): string | null {
  return volt < 200 ? t('Nur Geräte mit „100–240 V“ auf dem Netzteil verwenden – Föhn oder Wasserkocher für 230 V funktionieren nicht richtig') : null
}

// ---------------------------------------------------------------- Zeit

/** Abstand der Zeitzone zu UTC in Minuten zum Zeitpunkt `at` */
export function utcOffset(tz: string, at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  }).formatToParts(at)
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const local = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'))
  const minute = Math.floor(at.getTime() / 60000) * 60000
  return Math.round((local - minute) / 60000)
}

export function homeTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin'
}

/** Zeitunterschied zum Gerät in Minuten (positiv = dort später) */
export function timeDifference(tz: string, at: Date, home = homeTimeZone()): number {
  return utcOffset(tz, at) - utcOffset(home, at)
}

export function formatDifference(min: number): string {
  if (min === 0) return t('gleiche Zeit wie zu Hause')
  const h = Math.floor(Math.abs(min) / 60)
  const m = Math.abs(min) % 60
  const amount = m ? `${h}:${String(m).padStart(2, '0')}` : String(h)
  return min > 0 ? t('{amount} Std. später als zu Hause', { amount }) : t('{amount} Std. früher als zu Hause', { amount })
}

export function localTime(tz: string, at: Date): string {
  return at.toLocaleTimeString(intlLocale(), { timeZone: tz, hour: '2-digit', minute: '2-digit' })
}

// ---------------------------------------------------------------- Notruf

export interface EmergencyRow {
  label: string
  number: string
  main: boolean
}

/** Notrufnummern zum Anzeigen, ohne doppelte Nummern */
export function emergencyRows(e: Emergency): EmergencyRow[] {
  const rows: EmergencyRow[] = []
  const add = (label: string, n: string | undefined, main = false) => {
    if (!n) return
    const same = rows.find((r) => r.number === n)
    if (same) same.label = `${same.label}, ${label}`
    else rows.push({ label, number: n, main })
  }
  add(t('Notruf'), e.all, true)
  add(t('Polizei'), e.police)
  add(t('Rettung'), e.ambulance)
  add(t('Feuerwehr'), e.fire)
  if (e.other && !rows.some((r) => r.number === e.other)) rows.push({ label: t('auch'), number: e.other, main: false })
  return rows
}

/** Nummer für die Kurzfassung: allgemeiner Notruf, sonst die der Rettung */
export function mainEmergency(e: Emergency): string {
  return e.all ?? e.ambulance ?? e.police ?? ''
}

// ---------------------------------------------------------------- Texte

const TIPS: Record<TipStyle, string> = {
  aufrunden: t('Aufrunden oder etwa 5–10 %'),
  inklusive: t('Service ist im Preis – Aufrunden ist nett, aber nicht nötig'),
  zehn: t('Etwa 10 % sind üblich'),
  usa: t('15–20 % werden erwartet (Restaurant, Taxi, Hotel)'),
  unueblich: t('Unüblich – kann sogar irritieren')
}
export const tipText = (s: TipStyle) => TIPS[s]

const WATER: Record<WaterSafety, string> = {
  ja: t('In der Regel trinkbar'),
  teils: t('Regional unterschiedlich – im Zweifel abgefülltes Wasser'),
  nein: t('Nicht trinken – abgefülltes Wasser, auch zum Zähneputzen')
}
export const waterText = (w: WaterSafety) => WATER[w]

const TOLL: Record<TollKind, string> = {
  vignette: t('Vignette'),
  strecke: t('Streckenmaut'),
  keine: t('Keine allgemeine Pkw-Maut')
}
export const tollText = (k: TollKind) => TOLL[k]

const LIGHTS: Record<DaylightRule, string> = {
  immer: t('Abblendlicht auch tagsüber'),
  ausserorts: t('Abblendlicht tagsüber außerorts'),
  winter: t('Abblendlicht tagsüber im Winterhalbjahr')
}
export const lightsText = (r: DaylightRule) => LIGHTS[r]

export function speedRows(f: CountryFacts): { label: string; value: string }[] {
  if (!f.speed) return []
  const unit = f.mph ? 'mph' : 'km/h'
  const v = (s: string) => (s === '' ? t('nach Beschilderung') : s === '–' ? t('keine Autobahnen') : `${s} ${unit}`)
  return [
    { label: t('Innerorts'), value: v(f.speed[0]) },
    { label: t('Außerorts'), value: v(f.speed[1]) },
    { label: t('Autobahn'), value: v(f.speed[2]) }
  ]
}

export function promille(n: number): string {
  return `${n.toLocaleString(intlLocale(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ‰`
}

export function alcoholText(f: CountryFacts): string | null {
  if (f.alcohol === undefined) return null
  const main = promille(f.alcohol)
  return f.alcoholNew !== undefined && f.alcoholNew !== f.alcohol ? t('{main} · Fahranfänger {young}', { main, young: promille(f.alcoholNew) }) : main
}

// ---------------------------------------------------------------- Kurzfassung für die Reiseseite

export function countrySummary(code: string): string {
  const f = factsOf(code)
  const head = `${flag(code)} ${countryName(code)}`
  if (!f) return head
  const parts = [t('Notruf {number}', { number: mainEmergency(f.emergency) })]
  const fit = plugFit(f.plugs)
  if (fit === 'adapter') parts.push(t('Adapter Typ {types}', { types: f.plugs.split(' ').join('/') }))
  if (f.drive === 'L') parts.push(t('Linksverkehr'))
  if (f.alcohol === 0) parts.push(promille(0))
  return `${head}: ${parts.join(', ')}`
}

export function sheetSummary(countries: SheetCountry[]): string {
  if (!countries.length) return t('Zielland angeben → Strom, Notruf, Tempo, Maut, Trinkgeld')
  return countries.map((c) => countrySummary(c.code)).join(' · ')
}
