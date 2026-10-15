/** Notrufnummern eines Landes; `all` = allgemeiner Notruf, `other` = funktioniert ebenfalls */
export interface Emergency {
  all?: string
  other?: string
  police?: string
  ambulance?: string
  fire?: string
}

/** Wie Trinkgeld üblich ist */
export type TipStyle = 'aufrunden' | 'inklusive' | 'zehn' | 'usa' | 'unueblich'
/** Leitungswasser: in der Regel trinkbar / regional unterschiedlich / besser nicht */
export type WaterSafety = 'ja' | 'teils' | 'nein'
export type TollKind = 'vignette' | 'strecke' | 'keine'
/** Abblendlicht tagsüber: immer / außerorts / im Winter */
export type DaylightRule = 'immer' | 'ausserorts' | 'winter'

/** Feste Angaben für den Länder-Spickzettel (siehe data.ts) */
export interface CountryFacts {
  /** Steckdosen-Typen, z. B. "C F" */
  plugs: string
  /** Netzspannung in Volt */
  volt: number
  /** Ländervorwahl ohne „+“ */
  dial: string
  /** IANA-Zeitzone – fehlt bei Ländern mit mehreren Zeitzonen */
  tz?: string
  emergency: Emergency
  tip: TipStyle
  water: WaterSafety
  /** Linksverkehr (sonst rechts) */
  drive?: 'L'
  /** Pkw: [innerorts, außerorts, Autobahn]; '' = nach Beschilderung, '–' = keine Autobahn */
  speed?: [string, string, string]
  /** Tempoangaben in Meilen/h */
  mph?: boolean
  /** Promillegrenze allgemein bzw. für Fahranfänger */
  alcohol?: number
  alcoholNew?: number
  toll?: TollKind
  tollNote?: string
  lights?: DaylightRule
  /** Besonderheiten (übersetzte Sätze) */
  notes?: string[]
}

/** Ein Land auf dem Spickzettel einer Reise */
export interface SheetCountry {
  code: string
  /** Nur Durchreise (nicht Zielland) */
  transit: boolean
}
