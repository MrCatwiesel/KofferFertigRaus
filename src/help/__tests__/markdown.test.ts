import { describe, expect, it } from 'vitest'
import { plainText, renderInline, renderMarkdown } from '../markdown'

describe('Markdown für Hilfetexte', () => {
  it('Überschriften eine Stufe tiefer, Absätze zusammengefasst', () => {
    expect(renderMarkdown('## Titel\nZeile eins\nZeile zwei\n\nNeuer Absatz')).toBe('<h3>Titel</h3><p>Zeile eins Zeile zwei</p><p>Neuer Absatz</p>')
  })

  it('Aufzählung und nummerierte Liste', () => {
    expect(renderMarkdown('- a\n- b')).toBe('<ul><li>a</li><li>b</li></ul>')
    expect(renderMarkdown('1. a\n2. b')).toBe('<ol><li>a</li><li>b</li></ol>')
  })

  it('verschachtelte Liste und Rückkehr auf die obere Ebene', () => {
    expect(renderMarkdown('- a\n  - a1\n- b')).toBe('<ul><li>a<ul><li>a1</li></ul></li><li>b</li></ul>')
  })

  it('Wechsel von Liste zu Absatz', () => {
    expect(renderMarkdown('- a\nText')).toBe('<ul><li>a</li></ul><p>Text</p>')
  })

  it('Tipp-Kasten', () => {
    expect(renderMarkdown('> **Wichtig:** gut')).toContain('class="help-tip"')
    expect(renderMarkdown('> **Wichtig:** gut')).toContain('<strong>Wichtig:</strong> gut')
  })

  it('fett, kursiv, Code', () => {
    expect(renderInline('**fett** und *kursiv* und `a*b*c`')).toBe('<strong>fett</strong> und <em>kursiv</em> und <code>a*b*c</code>')
  })

  it('Links: intern in der App, extern im neuen Fenster, gefährliche gar nicht', () => {
    expect(renderInline('[Hilfe](#/hilfe/packliste)')).toBe('<a href="#/hilfe/packliste">Hilfe</a>')
    expect(renderInline('[Web](https://example.org)')).toBe('<a href="https://example.org" target="_blank" rel="noopener">Web</a>')
    expect(renderInline('[böse](javascript:alert(1))')).not.toContain('<a')
  })

  it('maskiert HTML', () => {
    expect(renderMarkdown('<img src=x onerror=alert(1)>')).toBe('<p>&lt;img src=x onerror=alert(1)&gt;</p>')
    expect(renderInline('[x](https://a.b/"onmouseover="y)')).not.toContain('"onmouseover')
  })

  it('reiner Text für die Suche', () => {
    expect(plainText('## Titel\n- **fett** [Link](#/x)\n> Tipp')).toBe('Titel fett Link Tipp')
  })
})
