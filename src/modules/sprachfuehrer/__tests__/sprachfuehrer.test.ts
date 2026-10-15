import { describe, expect, it } from 'vitest'
import { allCountries } from '@/core/countries'
import { ALLERGEN_GROUPS, ALLERGEN_IDS, ALLERGEN_SYNONYMS, GROUPS, PHRASE_IDS, SOURCE } from '../phrases'
import { LANGUAGES } from '../languages'
import { LANGUAGE_OF_COUNTRY, allergyCard, matchAllergen, nearbyNote, phrasebookSummary, phrasesIn, tripLanguages } from '../logic'

describe('Sätze', () => {
  it('jede Gruppe nutzt bekannte Sätze, jeder Satz steht in einer Gruppe oder auf der Allergie-Karte', () => {
    const grouped = new Set(GROUPS.flatMap((g) => g.phrases))
    for (const id of PHRASE_IDS) expect(grouped.has(id) || ['allergic', 'without', 'contains', 'bloodType'].includes(id), id).toBe(true)
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
    expect(allergyCard(LANGUAGES.it, 'it', [])).toBeNull()
    expect(allergyCard(LANGUAGES.it, 'it', ['peanuts', 'gluten'])!.lines).toEqual(['Ho un’allergia a:', 'arachidi, glutine', 'Per favore senza questi ingredienti – per me è pericoloso.'])
    const el = allergyCard(LANGUAGES.el, 'el', ['milk', 'kiwi'])!
    expect(el.lines[1]).toBe('γάλα, ακτινίδιο')
    expect(el.pron[1]).toBe('gála, aktinídio')
  })
  it('eigene Allergien: übersetzt, sonst wie eingegeben – und gemeldet', () => {
    const own = [
      { id: 'a', text: 'Koriander', tr: { it: 'coriandolo' } },
      { id: 'b', text: 'Fenchel', tr: { it: '  ' } }
    ]
    const it = allergyCard(LANGUAGES.it, 'it', ['eggs'], own)!
    expect(it.lines[1]).toBe('uova, coriandolo, Fenchel')
    expect(it.untranslated).toEqual(['Fenchel'])
    const fr = allergyCard(LANGUAGES.fr, 'fr', [], own)!
    expect(fr.lines[1]).toBe('Koriander, Fenchel')
    expect(fr.untranslated).toEqual(['Koriander', 'Fenchel'])
    expect(allergyCard(LANGUAGES.el, 'el', ['milk'], own)!.pron[1]).toBe('gála, Koriander, Fenchel')
  })
  it('Eintippen findet bekannte Allergene über Namen und Synonyme', () => {
    expect(matchAllergen('Erdnüsse')).toBe('peanuts')
    expect(matchAllergen(' haselnüsse ')).toBe('nuts')
    expect(matchAllergen('Muscheln')).toBe('molluscs')
    expect(matchAllergen('Weichtiere')).toBe('molluscs') // Name ohne Klammerzusatz
    expect(matchAllergen('ASS')).toBe('aspirin')
    expect(matchAllergen('shrimp')).toBe('shellfish')
    expect(matchAllergen('Koriander')).toBeNull()
    expect(matchAllergen('')).toBeNull()
  })
  it('alle Synonyme zeigen auf bekannte Allergene, Gruppen enthalten jedes genau einmal', () => {
    for (const id of Object.values(ALLERGEN_SYNONYMS)) expect(ALLERGEN_IDS).toContain(id)
    const grouped = ALLERGEN_GROUPS.flatMap((g) => g.ids)
    expect([...grouped].sort()).toEqual([...ALLERGEN_IDS].sort())
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
