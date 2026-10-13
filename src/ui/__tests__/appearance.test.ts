import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, normalizeSettings } from '../appearance'

describe('Aussehen: gespeicherte Einstellungen', () => {
  it('leer → Standard (Hintergrund nicht mehr so blass)', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(DEFAULT_SETTINGS.cover).toBeLessThanOrEqual(30)
  })
  it('übernimmt den Stil aus Version 1.15', () => {
    expect(normalizeSettings({ style: 'retro', mode: 'dunkel', background: false })).toMatchObject({ theme: 'retro', mode: 'dunkel', background: false })
  })
  it('begrenzt Regler und verwirft Unsinn', () => {
    const s = normalizeSettings({ theme: 'gibtsnicht', cover: 500, blur: -3, saturate: 'viel', cards: 30, textSize: 'riesig', corners: 'rund', layout: { view: 'liste' } })
    expect(s.theme).toBe('alpin')
    expect(s.cover).toBe(90)
    expect(s.blur).toBe(0)
    expect(s.saturate).toBe(100)
    expect(s.cards).toBe(30)
    expect(s.textSize).toBe('normal')
    expect(s.corners).toBe('rund')
    expect(s.layout.view).toBe('liste')
    expect(s.layout.tabs).toBe(true)
  })
})
