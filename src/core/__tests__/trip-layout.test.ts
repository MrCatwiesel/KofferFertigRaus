import { describe, expect, it } from 'vitest'
import { DEFAULT_LAYOUT, moveInTab, normalizeLayout, phasesOf, sectionsIn, togglePlacement, unplaced } from '../trip-layout'
import type { TripPhase } from '../registry'

const S = [
  { moduleId: 'anreise', phases: ['planung', 'unterwegs'] as TripPhase[] },
  { moduleId: 'packliste', phases: ['planung'] as TripPhase[] },
  { moduleId: 'tagebuch', phases: ['unterwegs', 'danach'] as TripPhase[] },
  { moduleId: 'webseite', phases: ['teilen'] as TripPhase[] },
  { moduleId: 'ohne' }
]

describe('Aufteilung der Reiseseite', () => {
  it('Standard: Vorgaben der Module, ohne Angabe → Planung', () => {
    expect(sectionsIn('planung', S, DEFAULT_LAYOUT).map((s) => s.moduleId)).toEqual(['anreise', 'packliste', 'ohne'])
    expect(sectionsIn('unterwegs', S, DEFAULT_LAYOUT).map((s) => s.moduleId)).toEqual(['anreise', 'tagebuch'])
    expect(unplaced(S, DEFAULT_LAYOUT)).toEqual([])
  })

  it('Bereich in anderen Reiter verschieben, entfernen → „Weitere Bereiche“', () => {
    let l = togglePlacement(DEFAULT_LAYOUT, S[1], 'unterwegs', true)
    expect(phasesOf(S[1], l)).toEqual(['planung', 'unterwegs'])
    l = togglePlacement(l, S[1], 'planung', false)
    expect(sectionsIn('planung', S, l).map((s) => s.moduleId)).toEqual(['anreise', 'ohne'])
    l = togglePlacement(l, S[1], 'unterwegs', false)
    expect(unplaced(S, l).map((s) => s.moduleId)).toEqual(['packliste'])
    expect(DEFAULT_LAYOUT.placement).toEqual({}) // unverändert
  })

  it('Reihenfolge im Reiter', () => {
    let l = moveInTab(DEFAULT_LAYOUT, S, 'planung', 'ohne', -1)
    expect(sectionsIn('planung', S, l).map((s) => s.moduleId)).toEqual(['anreise', 'ohne', 'packliste'])
    l = moveInTab(l, S, 'planung', 'ohne', -1)
    expect(sectionsIn('planung', S, l).map((s) => s.moduleId)).toEqual(['ohne', 'anreise', 'packliste'])
    expect(moveInTab(l, S, 'planung', 'ohne', -1)).toBe(l) // schon ganz oben
    // neu hinzugekommener Bereich erscheint trotzdem
    const more = [...S, { moduleId: 'neu', phases: ['planung'] as TripPhase[] }]
    expect(sectionsIn('planung', more, l).map((s) => s.moduleId)).toEqual(['ohne', 'anreise', 'packliste', 'neu'])
  })

  it('gespeicherte Werte prüfen', () => {
    expect(normalizeLayout(null)).toEqual(DEFAULT_LAYOUT)
    const l = normalizeLayout({ tabs: false, view: 'quatsch', hero: 'gross', placement: { a: ['planung', 'mond'], b: 'x' }, order: { planung: ['a', 3] } })
    expect(l.tabs).toBe(false)
    expect(l.view).toBe('kacheln')
    expect(l.hero).toBe('gross')
    expect(l.placement).toEqual({ a: ['planung'] })
    expect(l.order).toEqual({ planung: ['a'] })
  })
})
