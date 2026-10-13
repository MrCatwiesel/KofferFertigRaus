/**
 * Aufteilung der Reiseseite – welche Bereiche in welchem Reiter stehen, in welcher Reihenfolge und wie sie aussehen.
 * Reine Logik ohne DOM (testbar). Gespeichert wird je Gerät (siehe ui/appearance.ts).
 *
 * Sicherheitsnetz: Ein Bereich, der in keinem Reiter mehr steht, erscheint auf der Reiseseite unter
 * „Weitere Bereiche“ – so geht keine Funktion verloren.
 */
import type { TripPhase } from './registry'

export const PHASES: TripPhase[] = ['planung', 'unterwegs', 'danach', 'teilen']

export interface TripLayout {
  /** Reiter anzeigen – sonst alle Bereiche untereinander mit Zwischenüberschriften */
  tabs: boolean
  /** Beim Öffnen den Reiter wählen, der zum Datum passt (sonst immer „Planung“) */
  autoTab: boolean
  /** Darstellung der Bereiche */
  view: 'kacheln' | 'liste' | 'gross'
  /** Zusammenfassung unter dem Namen (z. B. „3 Nächte gebucht“) */
  summaries: boolean
  /** Höhe des Titelbilds */
  hero: 'aus' | 'klein' | 'mittel' | 'gross'
  /** Eckdaten (Zeitraum, Personen, Anreise, Budget) */
  facts: boolean
  /** Unterwegs: große Knöpfe „Heute“ und „Notfall“ */
  quick: boolean
  /** Eigene Zuordnung: Bereich (Modul-Kennung) → Reiter. Fehlt ein Eintrag, gilt die Vorgabe des Moduls. */
  placement: Record<string, TripPhase[]>
  /** Eigene Reihenfolge je Reiter (Modul-Kennungen); nicht genannte folgen in der Standard-Reihenfolge */
  order: Partial<Record<TripPhase, string[]>>
}

export const DEFAULT_LAYOUT: TripLayout = {
  tabs: true,
  autoTab: true,
  view: 'kacheln',
  summaries: true,
  hero: 'mittel',
  facts: true,
  quick: true,
  placement: {},
  order: {}
}

/** Was die Logik von einem Bereich braucht */
export interface LayoutSection {
  moduleId: string
  phases?: TripPhase[]
}

/** Zuordnung eines Bereichs (eigene oder Vorgabe) */
export function phasesOf(s: LayoutSection, l: TripLayout): TripPhase[] {
  return l.placement[s.moduleId] ?? s.phases ?? ['planung']
}

/** Bereiche eines Reiters in der gewählten Reihenfolge */
export function sectionsIn<T extends LayoutSection>(tab: TripPhase, all: readonly T[], l: TripLayout): T[] {
  const inTab = all.filter((s) => phasesOf(s, l).includes(tab))
  const order = l.order[tab] ?? []
  const rank = (s: T) => {
    const i = order.indexOf(s.moduleId)
    return i === -1 ? order.length + all.indexOf(s) : i
  }
  return [...inTab].sort((a, b) => rank(a) - rank(b))
}

/** Bereiche, die in keinem Reiter stehen (→ „Weitere Bereiche“) */
export function unplaced<T extends LayoutSection>(all: readonly T[], l: TripLayout): T[] {
  return all.filter((s) => phasesOf(s, l).length === 0)
}

/** Bereich in einen Reiter aufnehmen oder daraus entfernen (gibt eine neue Aufteilung zurück) */
export function togglePlacement(l: TripLayout, s: LayoutSection, tab: TripPhase, on: boolean): TripLayout {
  const cur = phasesOf(s, l)
  const next = on ? PHASES.filter((p) => p === tab || cur.includes(p)) : cur.filter((p) => p !== tab)
  return { ...l, placement: { ...l.placement, [s.moduleId]: next } }
}

/** Bereich im Reiter um `delta` Plätze verschieben */
export function moveInTab<T extends LayoutSection>(l: TripLayout, all: readonly T[], tab: TripPhase, moduleId: string, delta: number): TripLayout {
  const ids = sectionsIn(tab, all, l).map((s) => s.moduleId)
  const i = ids.indexOf(moduleId)
  const j = i + delta
  if (i === -1 || j < 0 || j >= ids.length) return l
  ;[ids[i], ids[j]] = [ids[j], ids[i]]
  return { ...l, order: { ...l.order, [tab]: ids } }
}

/** Gespeicherte Aufteilung prüfen und mit Standardwerten auffüllen (alte oder kaputte Werte vertragen) */
export function normalizeLayout(raw: unknown): TripLayout {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<TripLayout>
  const pick = <K extends keyof TripLayout>(k: K, ok: (v: unknown) => boolean): TripLayout[K] => (ok(r[k]) ? (r[k] as TripLayout[K]) : DEFAULT_LAYOUT[k])
  const bool = (v: unknown) => typeof v === 'boolean'
  const placement: Record<string, TripPhase[]> = {}
  if (r.placement && typeof r.placement === 'object')
    for (const [k, v] of Object.entries(r.placement)) if (Array.isArray(v)) placement[k] = v.filter((p): p is TripPhase => PHASES.includes(p as TripPhase))
  const order: Partial<Record<TripPhase, string[]>> = {}
  if (r.order && typeof r.order === 'object')
    for (const p of PHASES) {
      const v = (r.order as Record<string, unknown>)[p]
      if (Array.isArray(v)) order[p] = v.filter((x): x is string => typeof x === 'string')
    }
  return {
    tabs: pick('tabs', bool),
    autoTab: pick('autoTab', bool),
    view: pick('view', (v) => v === 'kacheln' || v === 'liste' || v === 'gross'),
    summaries: pick('summaries', bool),
    hero: pick('hero', (v) => v === 'aus' || v === 'klein' || v === 'mittel' || v === 'gross'),
    facts: pick('facts', bool),
    quick: pick('quick', bool),
    placement,
    order
  }
}
