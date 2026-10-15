import { describe, expect, it } from 'vitest'
import { fold, searchTopics, topicForRoute } from '../logic'
import type { HelpContent } from '../types'

const content: HelpContent = {
  groups: [{ id: 'start', title: 'Start', icon: 'flag' }],
  topics: [
    { id: 'packliste', title: 'Packliste', icon: 'x', group: 'start', summary: 'Packen', routes: ['packing-list'], body: 'Mit Vorlagen starten.' },
    { id: 'karte', title: 'Karte', icon: 'x', group: 'start', summary: 'Orte', keywords: 'gps', body: 'Auch die Packliste ist nicht hier. Offline-Karten speichern.' },
    { id: 'gross', title: 'Größe', icon: 'x', group: 'start', summary: '', body: 'Schriftgröße einstellen.' }
  ]
}

describe('Hilfe-Suche', () => {
  it('faltet Umlaute und ß', () => {
    expect(fold('Größe Übersicht')).toBe('grosse ubersicht')
  })

  it('Titel-Treffer stehen vorn', () => {
    expect(searchTopics(content, 'packliste').map((h) => h.topic.id)).toEqual(['packliste', 'karte'])
  })

  it('Wortanfang genügt, alle Wörter müssen passen', () => {
    expect(searchTopics(content, 'pack').length).toBe(2)
    expect(searchTopics(content, 'pack offline').map((h) => h.topic.id)).toEqual(['karte'])
  })

  it('Stichwörter zählen, Umlaute egal', () => {
    expect(searchTopics(content, 'GPS')[0].topic.id).toBe('karte')
    expect(searchTopics(content, 'grosse')[0].topic.id).toBe('gross')
  })

  it('Ausschnitt um den Treffer', () => {
    expect(searchTopics(content, 'offline')[0].snippet).toContain('Offline-Karten')
  })

  it('zu kurze Anfrage → nichts', () => {
    expect(searchTopics(content, 'a')).toEqual([])
  })

  it('Thema zur Seite', () => {
    expect(topicForRoute(content, 'packing-list')?.id).toBe('packliste')
    expect(topicForRoute(content, 'gibts-nicht')).toBeUndefined()
    expect(topicForRoute(content, undefined)).toBeUndefined()
  })
})
