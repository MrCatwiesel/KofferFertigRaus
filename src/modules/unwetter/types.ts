/** Eine amtliche Warnung (MeteoAlarm, über den eigenen Server – Antwort von GET /api/unwetter). */
import { N_, translated } from '@/core/i18n'
export interface Warnung {
  id: string
  /** ISO-Ländercode */
  land: string
  /** 2 = Gelb, 3 = Orange, 4 = Rot */
  stufe: number
  stufeName: string
  /** z. B. "gewitter" – Schlüssel aus ARTEN */
  art: string
  /** z. B. "Gewitter" */
  artName: string
  /** Bezeichnung des Wetterdienstes, z. B. "Gewitter" oder "Vigilance orange orages" (leer ohne Nachricht des Dienstes) */
  ereignis: string
  titel?: string
  text?: string
  hinweis?: string
  /** Wetterdienst, z. B. "GeoSphere Austria" */
  quelle?: string
  web?: string
  /** ISO-Zeit */
  beginn: string
  ende: string
  /** Warnregionen, in denen Reiseorte liegen */
  regionen: { id: string; name: string }[]
  /** Namen der Gebiete laut Wetterdienst */
  bereiche: string[]
  /** Indizes der betroffenen Orte (in `UnwetterStand.orte`) */
  orte: number[]
  /** Land ohne Ortszuordnung (z. B. Schweiz): Warnung irgendwo im Land */
  ortlos: boolean
}

/** Ort einer Reise, für den Warnungen gesucht werden */
export interface UnwetterOrt {
  name: string
  lat: number
  lon: number
  /** Zeitraum YYYY-MM-DD, in dem man dort ist */
  von: string
  bis: string
  quelle: 'unterkunft' | 'wetter' | 'ziel'
}

/** Zuletzt abgerufene Warnungen einer Reise – nur auf diesem Gerät (Zwischenspeicher wie das Wetter). */
export interface UnwetterStand {
  tripId: string
  fetchedAt: string
  orte: (UnwetterOrt & { regionen: { id: string; name: string; land: string }[] })[]
  warnungen: Warnung[]
  /** Länder ohne MeteoAlarm (außerhalb Europas) */
  ohneDaten: string[]
  fehler: string[]
}

export const STUFE_STIL: Record<number, { label: string; badge: string; alert: string; icon: string }> = translated({
  2: { label: N_('Gelb'), badge: 'text-bg-warning', alert: 'alert-warning', icon: 'exclamation-triangle' },
  3: { label: N_('Orange'), badge: 'stufe-orange', alert: 'alert-warning', icon: 'exclamation-triangle-fill' },
  4: { label: N_('Rot'), badge: 'text-bg-danger', alert: 'alert-danger', icon: 'exclamation-octagon-fill' }
})

/** Bootstrap-Icons je Art */
export const ART_ICON: Record<string, string> = {
  wind: 'wind',
  schnee: 'snow',
  gewitter: 'cloud-lightning-rain',
  nebel: 'cloud-fog2',
  hitze: 'thermometer-sun',
  kaelte: 'thermometer-snow',
  kueste: 'water',
  waldbrand: 'fire',
  lawinen: 'triangle',
  regen: 'cloud-rain-heavy',
  hochwasser: 'water',
  sonstiges: 'exclamation-triangle'
}

export const QUELLE_URL = 'https://meteoalarm.org'
