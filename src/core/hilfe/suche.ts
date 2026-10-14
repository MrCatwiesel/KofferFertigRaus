/** Suche und Textbausteine der Hilfe (ohne Vue). */
import type { HelpTopic } from './inhalt'

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

/** Themen zu einer Suche: alle Wörter müssen vorkommen; Treffer im Titel zuerst */
export function searchHelp(topics: HelpTopic[], query: string): HelpTopic[] {
  const words = norm(query).split(/\s+/).filter((w) => w.length > 1)
  if (!words.length) return topics
  const scored = topics.flatMap((t) => {
    const title = norm(t.title)
    const all = norm([t.title, t.keywords ?? '', ...t.text, ...(t.steps ?? [])].join(' '))
    if (!words.every((w) => all.includes(w))) return []
    return [{ t, score: words.filter((w) => title.includes(w)).length * 10 + words.filter((w) => norm(t.keywords ?? '').includes(w)).length }]
  })
  return scored.sort((a, b) => b.score - a.score).map((x) => x.t)
}

/** Thema zur Seite, von der aus „?“ getippt wurde (Name der Route oder deren Anfang) */
export function topicForRoute(topics: HelpTopic[], routeName: string): HelpTopic | undefined {
  if (!routeName) return undefined
  return topics.find((t) => t.routes?.includes(routeName)) ?? topics.find((t) => t.routes?.some((r) => routeName.startsWith(r)))
}

/** „Text mit **fett** und *Weg → in der App*“ → Abschnitte zum Anzeigen ohne HTML */
export function textParts(text: string): { text: string; style: 'fett' | 'kursiv' | '' }[] {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/)
    .filter(Boolean)
    .map((p) =>
      p.startsWith('**') && p.endsWith('**') && p.length > 4
        ? { text: p.slice(2, -2), style: 'fett' as const }
        : p.startsWith('*') && p.endsWith('*') && p.length > 2
          ? { text: p.slice(1, -1), style: 'kursiv' as const }
          : { text: p, style: '' as const }
    )
}
