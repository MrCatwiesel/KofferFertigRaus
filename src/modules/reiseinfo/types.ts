/** Ein Abschnitt der Reise- und Sicherheitshinweise, z. B. „Einreise und Zoll“ → „Reisedokumente“ */
export interface InfoSection {
  title: string
  /** Unterabschnitte (h3) mit Text; Absätze durch Leerzeile getrennt */
  parts: { title: string; text: string }[]
}

/** Deutsche Auslandsvertretung im Land (Botschaft, Konsulat, Honorarkonsul …) */
export interface Mission {
  id: string
  /** z. B. „Botschaft der Bundesrepublik Deutschland“ */
  description: string
  /** Botschaft/Generalkonsulat/Konsulat/Vertretungsbüro – false bei Honorarkonsuln */
  main: boolean
  city: string
  address: string
  phone: string
  /** Bereitschaftsdienst für Notfälle außerhalb der Öffnungszeiten (aus dem Text gelesen) */
  emergency: string
  mail: string
  website: string
  open: string
}

/** Reise- und Sicherheitshinweise des Auswärtigen Amts für ein Land einer Reise (wird abgeglichen). */
export interface CountryInfo {
  /** `${tripId}:${country}` */
  id: string
  tripId: string
  /** ISO-Code, z. B. "AT" */
  country: string
  countryName: string
  title: string
  /** Reisewarnung für das ganze Land / Teile */
  warning: boolean
  partialWarning: boolean
  /** Teilreisewarnung bzw. Warnung wegen besonderer Lage */
  situationWarning: boolean
  situationPartWarning: boolean
  /** Stand beim Auswärtigen Amt (ISO-Zeit) */
  lastModified: string
  /** Wann zuletzt abgerufen */
  fetchedAt: string
  /** Zuletzt Geändertes (Text) */
  lastChanges: string
  sections: InfoSection[]
  /** Impfungen, die im Abschnitt „Impfschutz“ genannt werden */
  vaccines: { name: string; required: boolean }[]
  /** Deutsche Auslandsvertretungen im Land (fehlt bei älteren Einträgen) */
  missions?: Mission[]
  /** Neu seit dem letzten Ansehen geändert */
  unseenChange: boolean
  createdAt: string
  updatedAt: string
}

export const SOURCE_URL = 'https://www.auswaertiges-amt.de/de/ReiseUndSicherheit/reise-und-sicherheitshinweise'
