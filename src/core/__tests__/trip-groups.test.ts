import { describe, expect, it } from 'vitest'
import { groupEntries, normalizeSearch, searchEntries, TRIP_GROUPS, type GroupEntry } from '../trip-groups'
import { getTripSections } from '../registry'
import { registerAllModules } from '@/modules'

registerAllModules()

const E: GroupEntry[] = [
  { id: 'packing', title: 'Packliste', icon: 'x', group: 'packen', keywords: 'Koffer, packen' },
  { id: 'accommodation', title: 'Unterkünfte', icon: 'x', group: 'anreise', keywords: 'Hotel, Ferienwohnung' },
  { id: 'dayplanner', title: 'Tagesplaner & Wetter', icon: 'x', group: 'programm' },
  { id: 'neu', title: 'Neues Modul', icon: 'x' }
]

describe('Themen-Gruppen', () => {
  it('verteilt jeden Eintrag genau einmal, Unbekanntes unter „Weitere“, leere Gruppen fallen weg', () => {
    const g = groupEntries(E)
    expect(g.map((x) => x.group.id)).toEqual(['anreise', 'programm', 'packen', 'weitere'])
    expect(g.flatMap((x) => x.items).map((e) => e.id).sort()).toEqual(E.map((e) => e.id).sort())
  })
  it('alle Bereiche der App haben eine Gruppe und Suchwörter – nichts landet unter „Weitere“', () => {
    const sections = getTripSections()
    expect(sections.length).toBeGreaterThan(20)
    for (const s of sections) {
      expect(TRIP_GROUPS.map((g) => g.id), s.moduleId).toContain(s.group)
      expect(s.keywords, s.moduleId).toBeTruthy()
    }
  })
})

describe('Suche', () => {
  it('findet über Wortanfang, Suchwörter und Gruppenname, ohne Groß/Klein und Umlaute', () => {
    expect(searchEntries(E, 'pack').map((e) => e.id)).toEqual(['packing'])
    expect(searchEntries(E, 'hotel').map((e) => e.id)).toEqual(['accommodation'])
    expect(searchEntries(E, 'UNTERKUNFTE').map((e) => e.id)).toEqual(['accommodation'])
    expect(searchEntries(E, 'unterkünfte').map((e) => e.id)).toEqual(['accommodation'])
    expect(searchEntries(E, 'wetter').map((e) => e.id)).toEqual(['dayplanner'])
    expect(searchEntries(E, 'tagesprogramm').map((e) => e.id)).toEqual(['dayplanner'])
    expect(searchEntries(E, '  ')).toEqual([])
  })
  it('alle Wörter müssen passen; Treffer im Namen zuerst', () => {
    expect(searchEntries(E, 'koffer pack').map((e) => e.id)).toEqual(['packing'])
    expect(searchEntries(E, 'koffer hotel')).toEqual([])
    const list: GroupEntry[] = [
      { id: 'a', title: 'Karte', icon: 'x', keywords: 'Wandern' },
      { id: 'b', title: 'Wanderrouten', icon: 'x' }
    ]
    expect(searchEntries(list, 'wander').map((e) => e.id)).toEqual(['b', 'a'])
  })
  it('vereinfacht Text', () => {
    expect(normalizeSearch(' Straße Äpfel ')).toBe('strasse apfel')
  })
})
