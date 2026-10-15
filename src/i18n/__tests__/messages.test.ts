import { describe, expect, it } from 'vitest'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
// @ts-expect-error – Hilfsskript ohne Typen
import { collectKeys, placeholders } from '../../../build/i18n-keys.mjs'
import { t, tn, useMessages, joinList, preferredLanguage } from '../index'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const { keys, problems } = collectKeys(root) as { keys: Map<string, string[]>; problems: string[] }
const codes = readdirSync(new URL('../locales/', import.meta.url)).map((f) => f.replace(/\.ts$/, ''))

describe('Übersetzungen', () => {
  it('Schlüssel sind feste Texte', () => {
    expect(problems).toEqual([])
    expect(keys.size).toBeGreaterThan(0)
  })

  for (const code of codes) {
    describe(code, async () => {
      const file = (await import(`../locales/${code}.ts`)) as { default: Record<string, string>; incomplete?: boolean }
      const dict = file.default

      it('jeder Text im Code ist übersetzt', () => {
        // Eine neue, halbfertige Sprache kann `export const incomplete = true` setzen
        if (file.incomplete) return
        const missing = [...keys.entries()].filter(([k]) => !dict[k]).map(([k, where]) => `${where[0]}: ${k}`)
        expect(missing, 'Fehlende Einträge – Liste: node build/i18n-keys.mjs fehlend ' + code).toEqual([])
      })

      it('keine überflüssigen Einträge', () => {
        expect(Object.keys(dict).filter((k) => !keys.has(k))).toEqual([])
      })

      it('gleiche Platzhalter wie im deutschen Text', () => {
        const wrong = Object.entries(dict).filter(([k, v]) => v && placeholders(k) !== placeholders(v))
        expect(wrong).toEqual([])
      })
    })
  }
})

describe('t / tn', () => {
  it('Deutsch ohne Wörterbuch, Platzhalter, Mehrzahl', () => {
    useMessages('de', {}, 'de-DE')
    expect(t('Noch {n} Tage', { n: 3 })).toBe('Noch 3 Tage')
    expect(tn(1, 'ein Foto', '{n} Fotos')).toBe('ein Foto')
    expect(tn(1200, 'ein Foto', '{n} Fotos')).toBe('1.200 Fotos')
    expect(joinList(['A', 'B', 'C'])).toBe('A, B und C')
  })

  it('Englisch mit Rückfall auf Deutsch', () => {
    useMessages('en', { 'Noch {n} Tage': '{n} days to go', '{n} Fotos': '{n} photos' }, 'en-GB')
    expect(t('Noch {n} Tage', { n: 3 })).toBe('3 days to go')
    expect(t('Gibt es nicht')).toBe('Gibt es nicht')
    expect(tn(2, 'ein Foto', '{n} Fotos')).toBe('2 photos')
    expect(joinList(['A', 'B', 'C'])).toBe('A, B and C')
    useMessages('de', {}, 'de-DE')
  })

  it('Sprache des Geräts', () => {
    expect(preferredLanguage(null, ['de-AT'])).toBe('de')
    expect(preferredLanguage(null, ['en-US', 'de-DE'])).toBe('en')
    expect(preferredLanguage(null, ['ja-JP'])).toBe('en')
    expect(preferredLanguage('en', ['de-DE'])).toBe('en')
    expect(preferredLanguage('xx', ['de-DE'])).toBe('de')
    expect(preferredLanguage(null, [])).toBe('de')
  })
})
