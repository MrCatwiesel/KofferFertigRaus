/** Unwetterwarnungen von MeteoAlarm (über den eigenen Server). */

/** Welche Warnungen zählen: die für die Orte der Reise, alle im Land – oder gar keine */
export type AlertScope = 'orte' | 'land' | 'aus'

/** Einstellung je Reise (steht an der Reise, gilt für alle Mitreisenden) */
export interface WeatherAlertSettings {
  scope: AlertScope
  /** Von Hand beobachtete Gebiete (Kennung von MeteoAlarm, z. B. „AT005“) */
  regions: string[]
  /** Namen der beobachteten Gebiete (nur zur Anzeige) */
  regionNames?: Record<string, string>
}

export interface WarningArea {
  name: string
  codes: string[]
}

/** Warum die Warnung „unsere“ ist */
export type MatchKind = 'region' | 'ort' | 'name' | 'land'

export interface WeatherWarning {
  id: string
  /** 2 gelb, 3 orange, 4 rot */
  level: number
  /** Warnart (MeteoAlarm awareness_type) */
  type: number
  typeName: string
  event: string
  headline: string
  description: string
  instruction: string
  /** Beginn und Ende mit Versatz der Ortszeit, z. B. 2026-07-02T14:00:00+02:00 */
  onset: string
  expires: string
  sender: string
  web: string
  areas: WarningArea[]
  match: { how: MatchKind; area: string } | null
}

export interface CountryWarnings {
  country: string
  fetchedAt: string
  warnings: WeatherWarning[]
}

/** Zuletzt abgerufene Warnungen einer Reise (auf dem Gerät, bleibt offline sichtbar) */
export interface WarningCache {
  tripId: string
  checkedAt: string
  countries: CountryWarnings[]
  /** Länder ohne Ergebnis – `unsupported`: MeteoAlarm kennt das Land nicht */
  errors: { country: string; message: string; unsupported?: boolean }[]
}

/** Was der Server zum Zuordnen braucht */
export interface Watch {
  scope: AlertScope
  points: [number, number][]
  names: string[]
  regions: string[]
}

export const LEVELS: Record<number, { label: string; text: string; bg: string; fg: string }> = {
  2: { label: 'Gelb', text: 'Achtung', bg: '#facc15', fg: '#422006' },
  3: { label: 'Orange', text: 'Gefährlich', bg: '#f97316', fg: '#1c0a00' },
  4: { label: 'Rot', text: 'Sehr gefährlich', bg: '#dc2626', fg: '#ffffff' }
}

export const TYPE_ICONS: Record<number, string> = {
  1: 'wind',
  2: 'snow',
  3: 'cloud-lightning-rain',
  4: 'cloud-fog2',
  5: 'thermometer-sun',
  6: 'thermometer-snow',
  7: 'tsunami',
  8: 'fire',
  9: 'snow2',
  10: 'cloud-rain-heavy',
  11: 'tropical-storm',
  12: 'water',
  13: 'cloud-rain-heavy'
}

export const MATCH_LABELS: Record<MatchKind, string> = {
  region: 'beobachtete Region',
  ort: 'ein Ort der Reise liegt im Gebiet',
  name: 'Gebiet passt zu einem Ort der Reise',
  land: 'ganzes Land'
}

export const SOURCE_URL = 'https://meteoalarm.org'
