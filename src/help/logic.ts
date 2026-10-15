import { plainText } from './markdown'
import type { HelpContent, HelpTopic } from './types'

/** Für die Suche: klein, ohne Akzente, ß → ss, Umlaute → Grundbuchstabe */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

/** Thema zur aktuellen Seite (Routen-Name) – oder undefined */
export function topicForRoute(content: HelpContent, routeName: unknown): HelpTopic | undefined {
  if (typeof routeName !== 'string') return undefined
  return content.topics.find((t) => t.routes?.includes(routeName))
}

export interface SearchHit {
  topic: HelpTopic
  /** Textausschnitt rund um den ersten Treffer im Inhalt (leer, wenn nur Titel/Stichwort passt) */
  snippet: string
  score: number
}

/**
 * Sucht in Titel, Stichwörtern, Zusammenfassung und Inhalt.
 * Alle Wörter der Anfrage müssen vorkommen (Wortanfang genügt, „pack“ findet „Packliste“).
 */
export function searchTopics(content: HelpContent, query: string): SearchHit[] {
  const words = fold(query).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2)
  if (!words.length) return []
  const hits: SearchHit[] = []
  for (const topic of content.topics) {
    const title = fold(topic.title)
    const keys = fold(`${topic.keywords ?? ''} ${topic.summary}`)
    const bodyPlain = plainText(topic.body)
    const body = fold(bodyPlain)
    let score = 0
    let ok = true
    for (const w of words) {
      const s = (title.includes(w) ? 6 : 0) + (keys.includes(w) ? 3 : 0) + (body.includes(w) ? 1 : 0)
      if (!s) {
        ok = false
        break
      }
      score += s
    }
    if (!ok) continue
    hits.push({ topic, snippet: snippetAround(bodyPlain, body, words), score })
  }
  return hits.sort((a, b) => b.score - a.score || a.topic.title.localeCompare(b.topic.title, 'de'))
}

/** ca. 150 Zeichen um den ersten Treffer, an Wortgrenzen geschnitten */
function snippetAround(plain: string, folded: string, words: string[]): string {
  const pos = Math.min(...words.map((w) => folded.indexOf(w)).filter((i) => i >= 0))
  if (!Number.isFinite(pos)) return ''
  // NFD-Faltung kann die Länge ändern (é → e + Akzent wird entfernt, ß → ss) – Position grob übertragen
  const ratio = plain.length / Math.max(1, folded.length)
  const at = Math.round(pos * ratio)
  let start = Math.max(0, at - 60)
  let end = Math.min(plain.length, at + 110)
  if (start > 0) start = plain.indexOf(' ', start) + 1 || start
  if (end < plain.length) end = plain.lastIndexOf(' ', end) > at ? plain.lastIndexOf(' ', end) : end
  return `${start > 0 ? '… ' : ''}${plain.slice(start, end).trim()}${end < plain.length ? ' …' : ''}`
}
