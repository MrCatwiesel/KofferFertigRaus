import { afterEach, describe, expect, it } from 'vitest'
// @ts-expect-error – Werkzeug in JavaScript (build/)
import { collectKeys, loadEnglish } from '../../../build/i18n-texte.mjs'
import { N_, deviceLang, fill, t, tn, translated, useDictForTests } from '../i18n'

/** Bereiche, die schon vollständig übersetzt sind (wächst mit jeder Version) */
const FERTIG = [/^App\.vue$/, /^core\//, /^ui\//, /^modules\/trip\//]

afterEach(() => useDictForTests('de', {}))

describe('Übersetzen', () => {
  it('Platzhalter benannt und als Liste, fehlende Übersetzung = Deutsch', () => {
    expect(fill('{n} Tage', { n: 3 })).toBe('3 Tage')
    expect(fill('{0} von {1}', [2, 5])).toBe('2 von 5')
    expect(fill('{x} bleibt', {})).toBe('{x} bleibt')
    useDictForTests('en', { '{n} Tage': '{n} days', 'Hallo {0}': 'Hello {0}' })
    expect(t('Hallo {0}', ['Anna'])).toBe('Hello Anna')
    expect(t('Nicht übersetzt')).toBe('Nicht übersetzt')
    expect(tn(1, '{n} Tag', '{n} Tage')).toBe('1 Tag')
    expect(tn(1200, '{n} Tag', '{n} Tage')).toBe('1,200 days')
  })

  it('Konstanten mit N_ werden beim Lesen übersetzt – auch verschachtelt', () => {
    const LABELS = translated({ auto: N_('Auto'), list: [{ label: N_('Bahn'), icon: 'train' }], code: 'kein-text' })
    useDictForTests('en', { Auto: 'Car', Bahn: 'Train' })
    expect(LABELS.auto).toBe('Car')
    expect(LABELS.list[0].label).toBe('Train')
    expect(LABELS.list[0].icon).toBe('train')
    expect(Object.values(LABELS)[0]).toBe('Car')
    useDictForTests('de', {})
    expect(LABELS.auto).toBe('Auto')
  })

  it('Sprache des Geräts (Englisch automatisch erst, wenn alles übersetzt ist)', () => {
    expect(deviceLang(['de-AT', 'en'], true)).toBe('de')
    expect(deviceLang(['fr-FR'], true)).toBe('en')
    expect(deviceLang(['en-GB'], false)).toBe('de')
  })
})

describe('Englische Texte', () => {
  const keys: Map<string, Set<string>> = collectKeys()
  it('fertige Bereiche sind vollständig übersetzt', async () => {
    const en: Record<string, string> = await loadEnglish()
    const missing = [...keys].filter(([k, files]) => !(k in en) && [...files].some((f) => FERTIG.some((r) => r.test(f)))).map(([k, f]) => `${[...f][0]}: ${k}`)
    expect(missing).toEqual([])
  })

  it('Übersetzungen erfinden keine Platzhalter', async () => {
    const en: Record<string, string> = await loadEnglish()
    const ph = (s: string) => new Set(s.match(/\{\w+\}/g) ?? [])
    const bad = Object.entries(en).filter(([de, e]) => [...ph(e)].some((p) => !ph(de).has(p))).map(([de]) => de)
    expect(bad).toEqual([])
  })
})
