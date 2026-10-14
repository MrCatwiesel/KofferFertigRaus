import { t } from '@/core/i18n'
/**
 * Zusammenführen beim Einlesen (Backup oder geteilte Reise): pro Datensatz gewinnt die neuere Änderung.
 * Reine Logik ohne Datenbank – dadurch einfach testbar.
 */

export type MergeDecision = 'add' | 'update' | 'skip'

/** Zeitstempel eines Datensatzes für den Vergleich (updatedAt, sonst createdAt, sonst fetchedAt). */
export function stampOf(row: Record<string, unknown> | undefined): string {
  if (!row) return ''
  for (const k of ['updatedAt', 'createdAt', 'fetchedAt']) {
    const v = row[k]
    if (typeof v === 'string' && v) return v
  }
  return ''
}

/**
 * Neu → hinzufügen. Vorhanden → nur ersetzen, wenn der eingelesene Datensatz neuer ist.
 * Bei gleichem Stand bleibt der vorhandene (nichts zu tun).
 */
export function decide(existing: Record<string, unknown> | undefined, incoming: Record<string, unknown>): MergeDecision {
  if (!existing) return 'add'
  return stampOf(incoming) > stampOf(existing) ? 'update' : 'skip'
}

export interface MergeStats {
  added: number
  updated: number
  unchanged: number
}

export function emptyStats(): MergeStats {
  return { added: 0, updated: 0, unchanged: 0 }
}

export function describeStats(s: MergeStats): string {
  const parts = []
  if (s.added) parts.push(t('{0} neu', [s.added]))
  if (s.updated) parts.push(t('{0} aktualisiert', [s.updated]))
  if (s.unchanged) parts.push(t('{0} unverändert', [s.unchanged]))
  return parts.length ? parts.join(', ') : t('nichts zu übernehmen')
}
