import { help as helpDe } from './topics.de'
import { language } from '@/i18n'
import type { HelpContent } from './types'

/**
 * Hilfe-Inhalt der gewählten Sprache: eine Datei je Sprache (`topics.<code>.ts`, Export `help`).
 * Deutsch ist immer dabei und dient als Rückfall; andere Sprachen werden erst beim Öffnen der Hilfe geladen.
 */
const files = import.meta.glob<{ help: HelpContent }>(['./topics.*.ts', '!./topics.de.ts'])

let loaded: HelpContent | null = null

/** Vor dem Anzeigen der Hilfe aufrufen (siehe router.ts) */
export async function prepareHelp(code = language()): Promise<HelpContent> {
  const loader = files[`./topics.${code}.ts`]
  loaded = loader ? (await loader().catch(() => null))?.help ?? helpDe : helpDe
  return loaded
}

export function helpContent(): HelpContent {
  return loaded ?? helpDe
}

export type { HelpContent, HelpGroup, HelpTopic } from './types'
