/**
 * Themen-Gruppen der Reiseseite (ab 2.0).
 *
 * Grundsatz: Jede Funktion steht in genau einer Gruppe. Die Reisephase (vorher, unterwegs, danach)
 * steuert nur „Jetzt wichtig“ oben auf der Seite – sie versteckt nichts. Bereiche ohne Gruppe
 * landen unter „Weitere“, so geht keine Funktion verloren. Reine Logik ohne DOM (testbar).
 */
import type { TripGroupId } from './registry'
import { t } from '@/i18n'

export interface TripGroupDef {
  id: TripGroupId | 'weitere'
  title: string
  icon: string
  /** Kennfarbe (Kachel leicht getönt, Symbol kräftig) – wirkt in hellen und dunklen Designs */
  color: string
}

export const TRIP_GROUPS: TripGroupDef[] = [
  { id: 'anreise', title: t('Anreise & Wohnen'), icon: 'airplane', color: '#168891' },
  { id: 'programm', title: t('Tagesprogramm'), icon: 'calendar-week', color: '#d07a26' },
  { id: 'karte', title: t('Karte & Touren'), icon: 'map', color: '#3d6fd0' },
  { id: 'packen', title: t('Packen & Erledigen'), icon: 'luggage', color: '#7e52c2' },
  { id: 'gesundheit', title: t('Gesundheit & Papiere'), icon: 'heart-pulse', color: '#cf3a4c' },
  { id: 'land', title: t('Land & Sprache'), icon: 'globe-europe-africa', color: '#3a9a4b' },
  { id: 'geld', title: t('Geld'), icon: 'wallet2', color: '#b58300' },
  { id: 'erinnern', title: t('Erinnern & Teilen'), icon: 'camera', color: '#4d6c88' }
]

export const OTHER_GROUP: TripGroupDef = { id: 'weitere', title: t('Weitere'), icon: 'grid', color: '#6b7a86' }

/** Ein Eintrag in einer Gruppe – ein Bereich eines Moduls oder ein fester Link der Reiseseite */
export interface GroupEntry {
  /** Modul-Kennung oder feste Kennung (z. B. „share-trip“) – auch für „Angeheftet“ */
  id: string
  title: string
  icon: string
  group?: TripGroupId
  keywords?: string
}

/** Einträge auf Gruppen verteilen – Reihenfolge der Gruppen fest, innerhalb wie übergeben. Leere Gruppen fallen weg. */
export function groupEntries<T extends GroupEntry>(entries: readonly T[]): { group: TripGroupDef; items: T[] }[] {
  const known = new Set(TRIP_GROUPS.map((g) => g.id))
  const out = TRIP_GROUPS.map((group) => ({ group, items: entries.filter((e) => e.group === group.id) }))
  const rest = entries.filter((e) => !e.group || !known.has(e.group))
  if (rest.length) out.push({ group: OTHER_GROUP, items: rest })
  return out.filter((g) => g.items.length)
}

/** Text für die Suche vereinfachen: klein, ohne Akzente, ß → ss */
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .trim()
}

/**
 * Suche über Name, Suchwörter und Gruppenname. Alle Wörter der Eingabe müssen vorkommen
 * (Wortanfänge genügen: „pack“ findet „Packliste“). Treffer im Namen zuerst.
 */
export function searchEntries<T extends GroupEntry>(entries: readonly T[], query: string): T[] {
  const words = normalizeSearch(query).split(/\s+/).filter(Boolean)
  if (!words.length) return []
  const groupTitle = (e: T) => [...TRIP_GROUPS, OTHER_GROUP].find((g) => g.id === (e.group ?? 'weitere'))?.title ?? ''
  const scored: { e: T; score: number }[] = []
  for (const e of entries) {
    const title = normalizeSearch(e.title)
    const hay = `${title} ${normalizeSearch(e.keywords ?? '')} ${normalizeSearch(groupTitle(e))}`
    if (!words.every((w) => hay.includes(w))) continue
    const score = words.every((w) => title.includes(w)) ? (title.startsWith(words[0]) ? 0 : 1) : 2
    scored.push({ e, score })
  }
  return scored.sort((a, b) => a.score - b.score).map((x) => x.e)
}
