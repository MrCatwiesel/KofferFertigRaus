import { describe, expect, it } from 'vitest'
import { HELP_GROUPS, HELP_TOPICS, INTRO_SLIDES } from '../hilfe/inhalt'
import { searchHelp, textParts, topicForRoute } from '../hilfe/suche'

describe('Hilfe', () => {
  it('Themen: eindeutige ids, bekannte Gruppen, Text vorhanden', () => {
    expect(new Set(HELP_TOPICS.map((t) => t.id)).size).toBe(HELP_TOPICS.length)
    for (const t of HELP_TOPICS) {
      expect(HELP_GROUPS).toContain(t.group)
      expect(t.text.length).toBeGreaterThan(0)
    }
    expect(INTRO_SLIDES.length).toBeGreaterThanOrEqual(3)
  })

  it('Suche: Umlaute egal, alle Wörter nötig, Titel zuerst', () => {
    expect(searchHelp(HELP_TOPICS, 'packliste')[0].id).toBe('packliste')
    expect(searchHelp(HELP_TOPICS, 'Gruen Gewitter').length).toBe(0)
    expect(searchHelp(HELP_TOPICS, 'gewitter')[0].id).toBe('unwetter')
    expect(searchHelp(HELP_TOPICS, 'home bildschirm').map((t) => t.id)).toContain('installieren')
    expect(searchHelp(HELP_TOPICS, 'Impfpaß').length).toBeGreaterThan(0)
    expect(searchHelp(HELP_TOPICS, ' ')).toBe(HELP_TOPICS)
  })

  it('„?“ einer Seite → passendes Thema (genau oder über den Anfang des Namens)', () => {
    expect(topicForRoute(HELP_TOPICS, 'dayplanner')?.id).toBe('tagesplan')
    expect(topicForRoute(HELP_TOPICS, 'journal-edit')?.id).toBe('tagebuch')
    expect(topicForRoute(HELP_TOPICS, 'accommodation-new')?.id).toBe('unterkuenfte')
    expect(topicForRoute(HELP_TOPICS, 'gibts-nicht')).toBeUndefined()
  })

  it('fett und kursiv ohne HTML', () => {
    expect(textParts('Ein **wichtiger** Weg: *Einstellungen → Aussehen*.')).toEqual([
      { text: 'Ein ', style: '' }, { text: 'wichtiger', style: 'fett' }, { text: ' Weg: ', style: '' }, { text: 'Einstellungen → Aussehen', style: 'kursiv' }, { text: '.', style: '' }
    ])
    expect(textParts('<b>nicht</b> 2 * 3')).toEqual([{ text: '<b>nicht</b> 2 * 3', style: '' }])
  })
})
