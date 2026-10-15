import { CATEGORY, type PackingCategory, type PackingDraft, type PackingItem } from './types'
import type { PackingTemplate, QuantityRule, TemplateItem } from './templates'
import { t } from '@/i18n'

export function emptyPackingDraft(over: Partial<PackingDraft> = {}): PackingDraft {
  return {
    name: '',
    category: 'sonstiges',
    quantity: 1,
    person: '',
    packed: false,
    essential: false,
    notes: '',
    ...over
  }
}

/** Menge aus einer Vorlagen-Regel, gerundet und mindestens 1. */
export function resolveQuantity(rule: QuantityRule | undefined, days: number, travelers: number): number {
  if (rule === undefined) return 1
  if (typeof rule === 'number') return Math.max(1, Math.round(rule))
  if ('perDay' in rule) return Math.max(1, Math.min(rule.max, Math.ceil(rule.perDay * days)))
  return Math.max(1, rule.perPerson * Math.max(1, travelers))
}

/** Normalisierter Name zum Vergleichen (Groß-/Kleinschreibung und Leerzeichen egal). */
export function normName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Ob ein Vorlagen-Eintrag pro Person angelegt wird. */
export function isPersonal(t: TemplateItem): boolean {
  if (t.personal) return true
  return typeof t.qty === 'object' && t.qty !== null
}

/**
 * Erzeugt Entwürfe aus mehreren Vorlagen.
 *  - Mit Teilnehmern: persönliche Dinge je Teilnehmer (Menge für eine Person),
 *    gemeinsame Dinge einmal.
 *  - Ohne Teilnehmer: jeder Eintrag einmal, "pro Person" wird mit der Personenzahl multipliziert.
 * Gleiche Dinge werden zusammengefasst (größte Menge, "wichtig" gewinnt);
 * was schon auf der Liste steht (gleicher Name für dieselbe Person oder gemeinsam), wird übersprungen.
 */
export function draftsFromTemplates(
  templates: PackingTemplate[],
  days: number,
  travelers: number,
  existing: Pick<PackingItem, 'name' | 'person'>[] = [],
  participants: string[] = []
): PackingDraft[] {
  const key = (name: string, person: string) => `${normName(name)}|${person.trim().toLowerCase()}`
  const have = new Set(existing.map((e) => key(e.name, e.person ?? '')))
  const merged = new Map<string, PackingDraft>()

  const put = (t: TemplateItem, person: string, qty: number) => {
    const k = key(t.name, person)
    if (have.has(k) || have.has(key(t.name, ''))) return
    const prev = merged.get(k)
    if (prev) {
      prev.quantity = Math.max(prev.quantity, qty)
      prev.essential = prev.essential || !!t.essential
    } else {
      merged.set(k, emptyPackingDraft({ name: t.name, category: t.category, quantity: qty, essential: !!t.essential, person }))
    }
  }

  for (const tpl of templates) {
    for (const t of tpl.items) {
      if (participants.length && isPersonal(t)) {
        for (const p of participants) put(t, p, resolveQuantity(t.qty, days, 1))
      } else {
        put(t, '', resolveQuantity(t.qty, days, travelers))
      }
    }
  }
  return [...merged.values()]
}

/**
 * Übernimmt Einträge einer anderen Reise: ausgepackt, ohne Doppelte.
 * Personen werden übernommen, wenn es sie auf dieser Reise gibt – sonst wird der Eintrag gemeinsam.
 */
export function draftsFromOtherTrip(
  source: PackingItem[],
  existing: Pick<PackingItem, 'name' | 'person'>[] = [],
  participants: string[] = []
): PackingDraft[] {
  const key = (name: string, person: string) => `${normName(name)}|${person.trim().toLowerCase()}`
  const have = new Set(existing.map((e) => key(e.name, e.person ?? '')))
  const known = new Map(participants.map((p) => [p.toLowerCase(), p]))
  const out: PackingDraft[] = []
  for (const s of source) {
    const person = known.get(s.person.trim().toLowerCase()) ?? ''
    const k = key(s.name, person)
    if (have.has(k) || have.has(key(s.name, ''))) continue
    have.add(k)
    const { id: _i, tripId: _t, createdAt: _c, updatedAt: _u, ...rest } = s
    out.push({ ...rest, person, packed: false })
  }
  return out
}

/** Filterwert für "nur gemeinsame Dinge". */
export const SHARED = '__gemeinsam__'

export interface PackingProgress {
  total: number
  packed: number
  percent: number
  /** Wichtige Dinge, die noch fehlen */
  essentialOpen: number
}

export function progress(list: PackingItem[]): PackingProgress {
  const total = list.length
  const packed = list.filter((i) => i.packed).length
  return {
    total,
    packed,
    percent: total ? Math.round((packed / total) * 100) : 0,
    essentialOpen: list.filter((i) => i.essential && !i.packed).length
  }
}

/** Fortschritt je Person (nur eigene Dinge) und für Gemeinsames. */
export function progressByPerson(list: PackingItem[], people: string[]): { person: string; progress: PackingProgress }[] {
  const names = [...new Set([...people, ...persons(list)])]
  return [
    ...names.map((p) => ({ person: p, progress: progress(list.filter((i) => i.person === p)) })),
    { person: SHARED, progress: progress(list.filter((i) => !i.person)) }
  ]
}

export interface PackingFilter {
  openOnly?: boolean
  /** '' = alle; SHARED = nur Gemeinsames; sonst nur Einträge dieser Person (optional plus Gemeinsames) */
  person?: string
  /** Bei Personenfilter auch gemeinsame Dinge zeigen (Standard: ja) */
  includeShared?: boolean
  search?: string
}

export interface CategoryGroup {
  category: PackingCategory
  items: PackingItem[]
  packed: number
}

/** Gruppiert nach Kategorie (feste Reihenfolge), innerhalb: offen vor gepackt, Wichtiges zuerst, dann alphabetisch. */
export function groupByCategory(list: PackingItem[], f: PackingFilter = {}): CategoryGroup[] {
  const q = f.search ? normName(f.search) : ''
  const filtered = list
    .filter((i) => !f.openOnly || !i.packed)
    .filter((i) => {
      if (!f.person) return true
      if (f.person === SHARED) return !i.person
      if (!i.person) return f.includeShared !== false
      return i.person === f.person
    })
    .filter((i) => !q || normName(i.name).includes(q))
  const groups = new Map<PackingCategory, PackingItem[]>()
  for (const i of filtered) {
    const g = groups.get(i.category) ?? []
    g.push(i)
    groups.set(i.category, g)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => CATEGORY[a].order - CATEGORY[b].order)
    .map(([category, items]) => ({
      category,
      packed: items.filter((i) => i.packed).length,
      items: items.sort(
        (a, b) =>
          Number(a.packed) - Number(b.packed) ||
          Number(b.essential) - Number(a.essential) ||
          a.name.localeCompare(b.name, 'de')
      )
    }))
}

/** Alle vorkommenden Personen, alphabetisch. */
export function persons(list: PackingItem[]): string[] {
  return [...new Set(list.map((i) => i.person.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'de'))
}

/**
 * Schnelleingabe: "3x Socken" oder "Socken x3" → Menge 3.
 * Alles andere wird als Name mit Menge 1 übernommen.
 */
export function parseQuickAdd(input: string): { name: string; quantity: number } {
  const s = input.trim()
  const pre = s.match(/^(\d{1,3})\s*[x×]\s*(.+)$/i)
  if (pre) return { name: pre[2].trim(), quantity: Math.max(1, Number(pre[1])) }
  const post = s.match(/^(.+?)\s*[x×]\s*(\d{1,3})$/i)
  if (post) return { name: post[1].trim(), quantity: Math.max(1, Number(post[2])) }
  return { name: s, quantity: 1 }
}

export function validatePacking(d: PackingDraft): Partial<Record<keyof PackingDraft, string>> {
  const e: Partial<Record<keyof PackingDraft, string>> = {}
  if (!d.name.trim()) e.name = t('Bitte einen Namen angeben.')
  if (!Number.isInteger(d.quantity) || d.quantity < 1) e.quantity = t('Mindestens 1.')
  return e
}
