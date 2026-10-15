import { getMeta, setMeta } from '@/core/meta'

/** Ein Abschnitt des Änderungsprotokolls */
export interface ReleaseNote {
  version: string
  /** z. B. "2026-10-14 (Server 1.20.0)" */
  label: string
  /** Inhalt als Markdown (ohne die Versions-Überschrift) */
  body: string
}

/** Zerlegt CHANGELOG.md in Versionen (neueste zuerst, wie in der Datei). */
export function parseChangelog(md: string): ReleaseNote[] {
  const notes: ReleaseNote[] = []
  for (const part of md.replace(/\r\n?/g, '\n').split(/^## /m).slice(1)) {
    const nl = part.indexOf('\n')
    const head = (nl < 0 ? part : part.slice(0, nl)).trim()
    const m = /^(\d+\.\d+\.\d+)\s*(?:[–-]\s*)?(.*)$/.exec(head)
    if (!m) continue
    notes.push({ version: m[1], label: m[2].trim(), body: nl < 0 ? '' : part.slice(nl + 1).trim() })
  }
  return notes
}

/** Vergleicht Versionsnummern wie 1.35.0 (negativ: a älter als b) */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d) return d
  }
  return 0
}

/** Versionen, die neuer sind als `seen` (höchstens `max`) */
export function notesSince(notes: ReleaseNote[], seen: string, max = 5): ReleaseNote[] {
  return notes.filter((n) => compareVersions(n.version, seen) > 0).slice(0, max)
}

/** Allgemeine Abschnitts-Überschriften ohne eigene Aussage */
const GENERIC = /^(neu|geändert|behoben|korrigiert|verbessert|sonstiges|stabilität|sicherheit)$/i

/** Die Titel der Neuerungen einer Version (### …) – für den kurzen Hinweis; „Neu:“ und Klammerzusätze fallen weg */
export function headlines(note: ReleaseNote): string[] {
  return [...note.body.matchAll(/^###\s+(.*)$/gm)]
    .map((m) => m[1].replace(/^(Neu|Korrigiert|Verbessert|Geändert|Behoben):\s*/, '').replace(/\s*\([^)]*\)\s*$/, '').trim())
    .filter((t) => t && !GENERIC.test(t))
}

export async function loadChangelog(): Promise<ReleaseNote[]> {
  const mod = await import('../../CHANGELOG.md?raw')
  return parseChangelog(mod.default)
}

/** Meta-Schlüssel: zuletzt gesehene Version (je Gerät) */
const SEEN = 'help.seenVersion'

/** Letzte Version ohne „Was ist neu“ – wer schon Reisen hat, bekommt ab hier die Neuerungen gezeigt */
export const FIRST_TRACKED = '1.35.0'

/**
 * Welche Version hat dieses Gerät zuletzt „gesehen“?
 * Beim allerersten Start (noch keine Daten) gibt es nichts nachzuholen – dann gilt die aktuelle Version als gesehen.
 * Wer die App schon vor „Was ist neu“ nutzte, sieht die Neuerungen seit {@link FIRST_TRACKED}.
 */
export async function seenVersion(current: string, hasData: boolean): Promise<string> {
  const seen = await getMeta<string | null>(SEEN, null)
  if (seen) return seen
  const start = hasData && compareVersions(current, FIRST_TRACKED) > 0 ? FIRST_TRACKED : current
  await setMeta(SEEN, start)
  return start
}

export async function markSeen(version: string): Promise<void> {
  await setMeta(SEEN, version)
}
