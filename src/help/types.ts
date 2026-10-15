/** Bereiche der Hilfe (Reihenfolge = Reihenfolge auf der Hilfe-Seite) */
export type HelpGroupId = 'start' | 'planen' | 'vorbereiten' | 'unterwegs' | 'erinnern' | 'gemeinsam' | 'einstellungen' | 'fragen'

export interface HelpGroup {
  id: HelpGroupId
  title: string
  /** Bootstrap-Icon-Name ohne "bi-" */
  icon: string
}

export interface HelpTopic {
  /** Teil der Adresse: #/hilfe/<id> – in allen Sprachen gleich */
  id: string
  title: string
  /** Bootstrap-Icon-Name ohne "bi-" */
  icon: string
  group: HelpGroupId
  /** Ein Satz für die Übersicht */
  summary: string
  /** Routen-Namen, deren „?“ hierher führt */
  routes?: string[]
  /** Weitere Suchwörter (Synonyme), durch Leerzeichen getrennt */
  keywords?: string
  /** Inhalt in einfachem Markdown (siehe markdown.ts) */
  body: string
}

/** Alles, was eine Sprache für die Hilfe liefert – eine Datei je Sprache */
export interface HelpContent {
  groups: HelpGroup[]
  topics: HelpTopic[]
}
