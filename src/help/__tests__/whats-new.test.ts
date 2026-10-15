import { describe, expect, it } from 'vitest'
import { compareVersions, headlines, notesSince, parseChangelog } from '../whats-new'

const MD = `# Änderungsprotokoll

## 1.36.0 – 2026-10-15

### Neu: Hilfe & Einführung
- eins

### Korrigiert: Karte
- zwei

## 1.35.1 – 2026-10-14 (Server 1.20.0)

### Verbessert: Tempo

## 1.35.0 – 2026-10-14

### Neu: Abstimmungen
`

describe('Was ist neu', () => {
  it('zerlegt das Änderungsprotokoll', () => {
    const notes = parseChangelog(MD)
    expect(notes.map((n) => n.version)).toEqual(['1.36.0', '1.35.1', '1.35.0'])
    expect(notes[1].label).toBe('2026-10-14 (Server 1.20.0)')
    expect(notes[0].body).toContain('- eins')
  })

  it('vergleicht Versionen als Zahlen', () => {
    expect(compareVersions('1.10.0', '1.9.9')).toBeGreaterThan(0)
    expect(compareVersions('1.35.0', '1.35.0')).toBe(0)
    expect(compareVersions('1.35.0', '1.36.0')).toBeLessThan(0)
  })

  it('nur Neueres als die gesehene Version', () => {
    expect(notesSince(parseChangelog(MD), '1.35.0').map((n) => n.version)).toEqual(['1.36.0', '1.35.1'])
    expect(notesSince(parseChangelog(MD), '1.36.0')).toEqual([])
  })

  it('Überschriften ohne „Neu:“, Klammern und allgemeine Wörter', () => {
    expect(headlines(parseChangelog(MD)[0])).toEqual(['Hilfe & Einführung', 'Karte'])
    expect(headlines({ version: '1', label: '', body: '### Neu\n### Behoben\n### Neu: Statistik (Reisen → „Statistik“)' })).toEqual(['Statistik'])
  })
})
