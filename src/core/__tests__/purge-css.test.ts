import { describe, expect, it } from 'vitest'
import { makeKeep, purgeCss } from '../../../build/purge-css.mjs'

const tokens = new Set(['btn', 'btn-primary', 'show', 'd-flex', 'bank', 'bi', 'col-md-6'])

describe('purgeCss', () => {
  it('behält genutzte Klassen, Elemente und Icons aus zusammengesetzten Namen', () => {
    const keep = makeKeep(tokens, [/^alert-/])
    expect(keep('.btn.btn-primary')).toBe(true)
    expect(keep('.btn-danger')).toBe(false)
    expect(keep('body')).toBe(true)
    expect(keep(':root')).toBe(true)
    expect(keep('.bi-bank::before')).toBe(true) // `bi-${icon}` mit icon = 'bank'
    expect(keep('.bi-tree::before')).toBe(false)
    expect(keep('.alert-warning')).toBe(true) // Sicherheitsliste
    expect(keep('.btn:not(.dropdown-toggle)')).toBe(true) // Klassen in :not() zählen nicht
    expect(keep('[class*="col-"]')).toBe(true)
  })

  it('räumt Regeln und leere @media-Blöcke weg, lässt @keyframes und @font-face stehen', () => {
    const css =
      '/*! Lizenz */@font-face{font-family:x;src:url(a.woff2)}.btn,.btn-danger{color:red}.unbenutzt{color:blue}' +
      '@media (min-width:768px){.col-md-6{width:50%}.col-md-7{width:58%}}@media print{.nie{display:none}}' +
      '@keyframes spin{from{transform:rotate(0)}to{transform:rotate(1turn)}}.d-flex{display:flex!important}' +
      '.x[data-a="{;}"]{content:"}"}'
    const { css: out, stats } = purgeCss(css, tokens)
    expect(out).toContain('/*! Lizenz */')
    expect(out).toContain('@font-face{font-family:x;src:url(a.woff2)}')
    expect(out).toContain('.btn{color:red}')
    expect(out).not.toContain('btn-danger')
    expect(out).not.toContain('unbenutzt')
    expect(out).toContain('@media (min-width:768px){.col-md-6{width:50%}}')
    expect(out).not.toContain('@media print')
    expect(out).toContain('@keyframes spin{from{transform:rotate(0)}to{transform:rotate(1turn)}}')
    expect(out).toContain('.d-flex{display:flex!important}')
    expect(out).not.toContain('data-a') // .x wird nicht genutzt – Zeichen in Zeichenketten stören das Zerlegen nicht
    expect(stats.removed).toBe(5)
  })
})
