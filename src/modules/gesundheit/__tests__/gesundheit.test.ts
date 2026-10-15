import { describe, expect, it } from 'vitest'
import { LANGUAGES } from '@/modules/sprachfuehrer/languages'
import { bloodTypeText, emergencyMeds, emptyDraft, hasContent, healthSummary, medicalCard, mergeDraft, passText, personsOf, profileId } from '../logic'
import { buildCardDoc, fitFontSize } from '../pdf-card'
import type { HealthProfile } from '../types'

const profile = (person: string, over: Partial<HealthProfile> = {}): HealthProfile => ({
  ...emptyDraft(),
  id: profileId('T', person),
  tripId: 'T',
  person,
  createdAt: '',
  updatedAt: '',
  ...over
})

describe('Gesundheit: Grundlagen', () => {
  it('feste ID je Reise und Person, Standard: für alle sichtbar', () => {
    expect(profileId('T1', 'Anna')).toBe('T1:gesundheit:Anna')
    expect(emptyDraft().sharedWith).toEqual(['*'])
    expect(hasContent(emptyDraft())).toBe(false)
    expect(hasContent({ ...emptyDraft(), bloodType: 'A+' })).toBe(true)
    expect(hasContent({ ...emptyDraft(), notes: '  ' })).toBe(false)
  })
  it('Personen: Teilnehmer, sonst „ich“, dazu alte Namen mit Angaben', () => {
    expect(personsOf([], [])).toEqual([''])
    expect(personsOf(['Anna', 'Ben'], [profile('Carl', { allergens: ['kiwi'] }), profile('Dora')])).toEqual(['Anna', 'Ben', 'Carl'])
  })
  it('Blutgruppe: auf Deutsch 0 statt O', () => {
    expect(bloodTypeText('O-', 'de')).toBe('0-')
    expect(bloodTypeText('O-', 'it')).toBe('O-')
    expect(bloodTypeText('AB+', 'de')).toBe('AB+')
  })
  it('Kurzfassung für die Reiseseite', () => {
    expect(healthSummary([])).toContain('eintragen')
    expect(healthSummary([profile('Anna', { allergens: ['peanuts', 'penicillin'] }), profile('Ben', { conditions: ['bloodThinner'] }), profile('Carl')])).toBe(
      'Anna: Erdnüsse, Penicillin · Ben: Nimmt Blutverdünner'
    )
    expect(healthSummary([profile('', { allergens: ['milk', 'eggs', 'fish', 'soy'] })])).toBe('Milch, Eier, Fisch …')
  })
})

describe('Notfallkarte', () => {
  const anna = profile('Anna', {
    allergens: ['peanuts'],
    custom: [{ id: 'k', text: 'Koriander', tr: { it: 'coriandolo' } }],
    conditions: ['diabetes', 'bloodThinner'],
    bloodType: 'O+'
  })
  it('in der Landessprache, mit Zeile in der Sprache der App', () => {
    const c = medicalCard(LANGUAGES.it, 'it', anna)
    expect(c.rows.map((r) => r.text)).toEqual(['Ho un’allergia a:', 'arachidi, coriandolo', 'Prendo anticoagulanti.', 'Ho il diabete.', 'Gruppo sanguigno: O+'])
    expect(c.rows.map((r) => r.source)).toEqual(['Ich habe eine Allergie gegen:', 'Erdnüsse, Koriander', 'Ich nehme Blutverdünner.', 'Ich habe Diabetes.', 'Blutgruppe: 0+'])
    expect(c.rows.filter((r) => r.strong).length).toBe(2)
    expect(c.untranslated).toEqual([])
  })
  it('Griechisch mit Umschrift, fehlende Übersetzung gemeldet, Restaurant-Satz auf Wunsch', () => {
    const c = medicalCard(LANGUAGES.el, 'el', anna, { restaurant: true })
    expect(c.rows[1].text).toBe('αράπικα φιστίκια, Koriander')
    expect(c.rows[1].pron).toBe('arápika fistíkia, Koriander')
    expect(c.untranslated).toEqual(['Koriander'])
    expect(c.rows.at(-1)!.text).toContain('Χωρίς')
  })
  it('ohne Zielsprache: nur in der Sprache der App', () => {
    const c = medicalCard(null, '', anna)
    expect(c.rows[0].text).toBe('Ich habe eine Allergie gegen:')
    expect(c.rows.every((r) => r.pron === '')).toBe(true)
    expect(c.untranslated).toEqual([])
  })
  it('alle Sprachen haben die Sätze für Erkrankungen und Blutgruppe', () => {
    for (const [code, l] of Object.entries(LANGUAGES)) {
      const c = medicalCard(l, code, { ...emptyDraft(), conditions: ['bloodThinner', 'diabetes', 'asthma', 'pacemaker'], bloodType: 'A-' })
      expect(c.rows.length, code).toBe(5)
      for (const r of c.rows) expect(r.text.trim().length, `${code}: ${r.source}`).toBeGreaterThan(4)
    }
  })
  it('Medikamente: Dauer- und Notfallmedikamente der Person oder für alle (bei „ich“)', () => {
    const meds = [
      { person: 'Anna', kind: 'dauer', name: 'Metformin', dose: '500 mg' },
      { person: 'Anna', kind: 'bedarf', name: 'Ibuprofen', dose: '' },
      { person: 'Ben', kind: 'notfall', name: 'EpiPen', dose: '' },
      { person: '', kind: 'dauer', name: 'Vitamin D', dose: '' }
    ]
    expect(emergencyMeds(meds, 'Anna').map((m) => m.name)).toEqual(['Metformin'])
    expect(emergencyMeds(meds, '').map((m) => m.name)).toEqual(['Vitamin D'])
  })
  it('Text für den Notfallpass', () => {
    expect(passText({ ...anna, notes: 'EpiPen in der Handtasche' }, [{ name: 'Metformin', dose: '500 mg' }])).toBe(
      'Allergien: Erdnüsse, Koriander\nErkrankungen: Nimmt Blutverdünner, Diabetes\nMedikamente: Metformin (500 mg)\nBlutgruppe: 0+\nEpiPen in der Handtasche'
    )
  })
  it('Übernehmen ergänzt, ohne Vorhandenes zu überschreiben', () => {
    const base = { ...emptyDraft(), allergens: ['milk' as const], custom: [{ id: '1', text: 'Koriander', tr: { it: 'coriandolo' } }], bloodType: 'A+' }
    const m = mergeDraft(base, { allergens: ['peanuts', 'milk'], custom: [{ id: '2', text: 'koriander', tr: { fr: 'coriandre', it: 'x' } }, { id: '3', text: 'Fenchel', tr: {} }], bloodType: 'B+', notes: 'neu' })
    expect(m.allergens).toEqual(['peanuts', 'milk'])
    expect(m.custom.map((c) => c.text)).toEqual(['Koriander', 'Fenchel'])
    expect(m.custom[0].tr).toEqual({ fr: 'coriandre', it: 'coriandolo' })
    expect(m.bloodType).toBe('A+')
    expect(m.notes).toBe('neu')
  })
})

describe('PDF-Karte', () => {
  it('Schrift wird bei langem Text kleiner', () => {
    expect(fitFontSize(['kurz'])).toBe(11)
    expect(fitFontSize(Array(12).fill('ein ziemlich langer Satz mit vielen Wörtern darin, der umbricht'))).toBeLessThan(8)
  })
  it('je Person ein Feld vorne und hinten', () => {
    const side = { languageLabel: 'Italienisch', rows: [{ text: 'Ho un’allergia a:', strong: false }], extra: [] }
    const doc = buildCardDoc([{ name: 'Anna', front: side, back: side }, { name: 'Ben', front: side, back: null }], 'Notfallkarte')
    const content = doc.content as { table?: { body: unknown[][] } }[]
    const tables = content.filter((c) => c.table)
    expect(tables.length).toBe(2)
    expect(tables[0].table!.body[0].length).toBe(2)
    expect(tables[1].table!.body[0].length).toBe(1)
    expect(JSON.stringify(doc)).toContain('Ho un’allergia a:')
  })
})
