import { helpDe } from './topics.de'
import type { HelpContent } from './types'

/**
 * Hilfe-Inhalt der aktuellen Sprache.
 * Mit der Mehrsprachigkeit wird hier die Datei passend zur gewählten Sprache geliefert.
 */
export function helpContent(): HelpContent {
  return helpDe
}

export type { HelpContent, HelpGroup, HelpTopic } from './types'
