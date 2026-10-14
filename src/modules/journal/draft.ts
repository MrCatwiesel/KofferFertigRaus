/**
 * Tagebuch-Entwurf aus dem, was an einem Tag gespeichert ist (Anreise, Wetter, Unternehmungen,
 * Touren, Unterkunft, Ausgaben). Die Sätze kommen von den anderen Modulen (Registry `dayFacts`);
 * hier werden sie zu Titel, Ort und Text zusammengesetzt. Ohne Internet, ohne KI – ein Gerüst
 * zum Weiterschreiben.
 */
import type { DayFact } from '@/core/registry'

export interface DayDraft {
  title: string
  location: string
  text: string
  /** Anzahl der verwendeten Bausteine (0 = nichts gefunden) */
  facts: number
}

const pick = (facts: readonly DayFact[], key: 'title' | 'location', rank: 'titleRank' | 'locationRank') =>
  [...facts].filter((f) => f[key]).sort((a, b) => (a[rank] ?? 99) - (b[rank] ?? 99))[0]?.[key] ?? ''

export function composeDayDraft(facts: readonly DayFact[], ctx: { dayNo: number; destination: string }): DayDraft {
  const sorted = [...facts].sort((a, b) => a.order - b.order)
  // Absätze: Rahmen (Anreise, Wetter) · Erlebtes (Unternehmungen, Touren) · Abend (Unterkunft, Ausgaben)
  const groups = [sorted.filter((f) => f.order < 30), sorted.filter((f) => f.order >= 30 && f.order < 50), sorted.filter((f) => f.order >= 50)]
  return {
    title: pick(sorted, 'title', 'titleRank') || (ctx.dayNo > 0 ? `Tag ${ctx.dayNo}` : ''),
    location: pick(sorted, 'location', 'locationRank') || ctx.destination.split(',')[0].trim(),
    text: groups
      .filter((g) => g.length)
      .map((g) => g.map((f) => f.text).join(' '))
      .join('\n\n'),
    facts: sorted.length
  }
}

/** Entwurf in den Eintrag übernehmen: leere Felder füllen, vorhandenen Text nie überschreiben, sondern ergänzen */
export function applyDayDraft<T extends { title: string; location: string; text: string }>(current: T, d: DayDraft): T {
  const text = current.text.trim()
  return {
    ...current,
    title: current.title.trim() ? current.title : d.title,
    location: current.location.trim() ? current.location : d.location,
    text: !d.text || text.includes(d.text) ? current.text : text ? `${text}\n\n${d.text}` : d.text
  }
}
