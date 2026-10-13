import { describe, expect, it } from 'vitest'
import { THEMES, contrast, getTheme, mix, patternCss, themeVars } from '../themes'

describe('Designs', () => {
  it('zwischen 10 und 20 Designs, eindeutige Kennungen', () => {
    expect(THEMES.length).toBeGreaterThanOrEqual(10)
    expect(THEMES.length).toBeLessThanOrEqual(20)
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length)
    expect(getTheme('gibtsnicht').id).toBe('alpin')
  })

  // Lesbarkeit nach WCAG: Text 4,5:1 (Fließtext), Hauptfarbe als Link/Symbol mindestens 3:1
  for (const t of THEMES)
    for (const mode of ['light', 'dark'] as const) {
      it(`${t.label} (${mode === 'light' ? 'hell' : 'dunkel'}) ist gut lesbar`, () => {
        const p = t[mode]
        const problems: string[] = []
        const need = (name: string, a: string, b: string, min: number) => {
          const c = contrast(a, b)
          if (c < min) problems.push(`${name}: ${c.toFixed(2)} < ${min}`)
        }
        need('Text auf Hintergrund', p.text, p.bg, 7)
        need('Text auf Karte', p.text, p.surface, 7)
        need('Grauer Text auf Karte', p.muted, p.surface, 4.5)
        need('Grauer Text auf Fläche 2', p.muted, p.surface2, 4.5)
        need('Knopfschrift', p.onPrimary, p.primary, 4.5)
        need('Hauptfarbe auf Karte', p.primary, p.surface, 4.5)
        need('Akzent auf Karte', p.accent, p.surface, 3)
        expect(problems).toEqual([])
      })
    }

  it('CSS-Variablen vollständig, Muster je Art', () => {
    const v = themeVars(getTheme('retro'), false)
    expect(v['--nww-primary-rgb']).toBe('31, 111, 120')
    expect(v['--nww-radius']).toBe('0.45rem')
    expect(Object.values(v).every((x) => typeof x === 'string' && x.length > 0)).toBe(true)
    expect(themeVars(getTheme('alpin'), false, { radius: 0 })['--nww-radius']).toBe('0rem')
    expect(patternCss('topo', getTheme('alpin').light, 0)).toBe('none')
    expect(patternCss('dots', getTheme('alpin').light, 1)).toContain('radial-gradient')
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080')
  })
})
