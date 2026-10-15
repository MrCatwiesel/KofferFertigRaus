import { describe, expect, it } from 'vitest'
import { allCountries } from '@/core/countries'
import { ALLERGEN_IDS, GROUPS, PHRASE_IDS, SOURCE } from '../phrases'
import { LANGUAGES } from '../languages'
import { LANGUAGE_OF_COUNTRY, allergyCard, nearbyNote, phrasebookSummary, phrasesIn, tripLanguages } from '../logic'

describe('Sätze', () => {
  it('jede Gruppe nutzt bekannte Sätze, jeder Satz steht in einer Gruppe oder auf der Allergie-Karte', () => {
    const grouped = new Set(GROUPS.flatMap((g) => g.phrases))
    for (const id of PHRASE_IDS) expect(grouped.has(id) || ['allergic', 'without', 'contains'].includes(id), id).toBe(true)
    for (const id of PHRASE_IDS) expect(SOURCE[id], id).toBeTruthy()
  })
  it.each(Object.entries(LANGUAGES))('%s ist vollständig', (code, l) => {
    for (const id of PHRASE_IDS) {
      if (id === 'english' && code === 'en') continue
      expect(l.phrases[id]?.trim(), `${code}.${id}`).toBeTruthy()
    }
    if (code === 'en') expect(l.phrases.english).toBeUndefined()
    for (const a of ALLERGEN_IDS) expect(l.allergens[a]?.trim(), `${code}.${a}`).toBeTruthy()
    expect(() => new Intl.Locale(l.speech)).not.toThrow()
    if (l.pron) {
      for (const id of PHRASE_IDS) if (l.phrases[id]) expect(l.pron.phrases[id], `${code} Umschrift ${id}`).toBeTruthy()
      for (const a of ALLERGEN_IDS) expect(l.pron.allergens[a], `${code} Umschrift ${a}`).toBeTruthy()
      // Umschrift nur mit lateinischen Buchstaben
      for (const s of Object.values(l.pron.phrases)) expect(s).not.toMatch(/[Ͱ-Ͽ]/)
    }
    // Satzzeichen: Fragen enden mit Fragezeichen (Griechisch: ;)
    const q = code === 'el' ? ';' : '?'
    for (const id of ['price', 'toilet', 'hospital'] as const) expect(l.phrases[id]!.trim().endsWith(q), `${code}.${id}`).toBe(true)
  })
  it('Griechisch nutzt griechische Schrift', () => {
    expect(LANGUAGES.el.phrases.thanks).toMatch(/[Ͱ-Ͽ]/)
  })
})

describe('Länder und Sprachen', () => {
  it('nur bekannte Länder und Sprachen', () => {
    const known = new Set(allCountries().map((c) => c.code).concat('DE'))
    for (const [c, langs] of Object.entries(LANGUAGE_OF_COUNTRY)) {
      expect(known.has(c), c).toBe(true)
      for (const l of langs) expect(LANGUAGES[l], `${c} → ${l}`).toBeDefined()
    }
  })
  it('Sprachen der Reise ohne die der App, Schweiz mehrsprachig, ohne doppelte', () => {
    const r = tripLanguages(['IT', 'AT', 'CH', 'SM'], LANGUAGES, 'de')
    expect(r).toEqual([
      { lang: 'it', countries: ['IT', 'CH', 'SM'] },
      { lang: 'fr', countries: ['CH'] }
    ])
    expect(tripLanguages(['AT'], LANGUAGES, 'en')).toEqual([{ lang: 'de', countries: ['AT'] }])
    expect(tripLanguages(['IS'], LANGUAGES, 'de')).toEqual([])
  })
  it('Hinweise für verwandte Sprachen', () => {
    expect(nearbyNote('SK', 'cs')).toContain('Slowakei')
    expect(nearbyNote('RS', 'hr')).toContain('Serbien')
    expect(nearbyNote('HR', 'hr')).toBeNull()
  })
})

describe('Allergie-Karte und Kurzfassung', () => {
  it('Karte in der Zielsprache, mit Umschrift', () => {
    expect(allergyCard(LANGUAGES.it, [])).toBeNull()
    expect(allergyCard(LANGUAGES.it, ['peanuts', 'gluten'])!.lines).toEqual(['Ho un’allergia a:', 'arachidi, glutine', 'Per favore senza questi ingredienti – per me è pericoloso.'])
    const el = allergyCard(LANGUAGES.el, ['milk'])!
    expect(el.lines[1]).toBe('γάλα')
    expect(el.pron[1]).toBe('gála')
  })
  it('fehlende Sätze werden ausgelassen', () => {
    expect(phrasesIn(LANGUAGES.en, ['hello', 'english'])).toEqual(['hello'])
  })
  it('Kurzfassung', () => {
    expect(phrasebookSummary([{ lang: 'it' }, { lang: 'fr' }], true)).toBe(`Italienisch und Französisch – ${PHRASE_IDS.length} Sätze, auch offline`)
    expect(phrasebookSummary([], true)).toContain('Landessprache wie die App')
    expect(phrasebookSummary([], false)).toContain('Zielland angeben')
  })
})
