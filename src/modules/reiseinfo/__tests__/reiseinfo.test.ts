import { describe, expect, it } from 'vitest'
import fixture from '../../../../e2e/fixtures/aa-oesterreich.json'
import { decodeEntities, findVaccines, htmlToText, parseTravelWarning, splitSections, warningLabel } from '../parse'
import { infoDocuments } from '../logic'
import type { CountryInfo } from '../types'
import { countryName, flag, guessCountries } from '@/core/countries'

const info = (over: Partial<CountryInfo> = {}): CountryInfo => ({
  ...parseTravelWarning(fixture),
  id: 't1:AT',
  tripId: 't1',
  fetchedAt: '',
  unseenChange: false,
  createdAt: '',
  updatedAt: '',
  ...over
})

describe('Text aus dem HTML', () => {
  it('wandelt Zeichen-Codes um', () => {
    expect(decodeEntities('&Ouml;sterreich &amp; Gr&uuml;&szlig;e &#8364; &#x41;')).toBe('Österreich & Grüße € A')
    expect(decodeEntities('&unbekannt;')).toBe('&unbekannt;')
  })
  it('behält Absätze und Listen, entfernt Skripte und Tags', () => {
    expect(htmlToText('<p>Eins</p><script>alert(1)</script><ul><li>a</li><li><b>b</b></li></ul>')).toBe('Eins\n\n• a\n• b')
  })
  it('zerlegt in Abschnitte und Unterabschnitte', () => {
    const s = splitSections('<h2>A</h2><p>Einleitung</p><h3>A1</h3><p>x</p><h2>B</h2><h3>B1</h3><p>y</p><h3>leer</h3>')
    expect(s).toEqual([
      { title: 'A', parts: [{ title: '', text: 'Einleitung' }, { title: 'A1', text: 'x' }] },
      { title: 'B', parts: [{ title: 'B1', text: 'y' }] }
    ])
  })
})

describe('Impfungen', () => {
  it('erkennt genannte Impfungen', () => {
    expect(findVaccines('Empfohlen: Hepatitis A, Typhus und Tollwut.').map((v) => v.name)).toEqual(['Hepatitis A', 'Typhus', 'Tollwut'])
  })
  it('Gelbfieber als Pflicht, wenn ein Nachweis vorgeschrieben ist', () => {
    expect(findVaccines('Bei Einreise ist der Nachweis einer Gelbfieberimpfung vorgeschrieben.')).toEqual([{ name: 'Gelbfieber', required: true }])
    expect(findVaccines('Eine Gelbfieberimpfung wird empfohlen.')).toEqual([{ name: 'Gelbfieber', required: false }])
    expect(findVaccines('Es ist keine Gelbfieberimpfung vorgeschrieben.')[0].required).toBe(false)
  })
})

describe('Reisehinweise Österreich', () => {
  it('liest Land, Stand, Warnlage und Impfungen', () => {
    const i = info()
    expect(i.country).toBe('AT')
    expect(i.countryName).toBe('Österreich')
    expect(i.lastModified).toBe(new Date(1760000000 * 1000).toISOString())
    expect(i.lastChanges).toBe('Aktualisierung: Abschnitt Gesundheit')
    expect(warningLabel(i)).toEqual({ level: 'ok', text: 'Keine Reisewarnung' })
    expect(i.vaccines.map((v) => v.name)).toEqual(['FSME', 'Tetanus', 'Diphtherie', 'Masern'])
    expect(i.vaccines.some((v) => v.required)).toBe(false)
  })
  it('wirft bei leerer Antwort', () => {
    expect(() => parseTravelWarning({ response: { contentList: [] } })).toThrow()
  })
  it('Warnstufen', () => {
    expect(warningLabel(info({ warning: true })).level).toBe('danger')
    expect(warningLabel(info({ situationPartWarning: true })).level).toBe('warning')
  })
  it('drei Einträge für die Dokumentenliste', () => {
    const [entry, vacc, sec] = infoDocuments(info())
    expect(entry).toMatchObject({ source: 'aa:AT:einreise', type: 'visum', title: 'Einreise Österreich', status: 'vorhanden' })
    expect(entry.notes).toContain('Personalausweis: Ja')
    expect(entry.notes).toContain('Quelle: Auswärtiges Amt')
    expect(vacc).toMatchObject({ source: 'aa:AT:impfschutz', type: 'gesundheit', title: 'Impfschutz Österreich', status: 'vorhanden' })
    expect(vacc.notes).toContain('FSME')
    expect(sec).toMatchObject({ source: 'aa:AT:sicherheit', title: 'Sicherheitslage Österreich: Keine Reisewarnung' })
    expect(sec.notes).toContain('Taschendiebe')
  })
  it('Visum nötig / Gelbfieber-Pflicht → „fehlt“', () => {
    const i = info({
      sections: [
        { title: 'Einreise und Zoll', parts: [{ title: 'Visum', text: 'Für die Einreise ist ein Visum erforderlich.' }] },
        { title: 'Gesundheit', parts: [{ title: 'Impfschutz', text: 'Gelbfieber-Nachweis vorgeschrieben.' }] }
      ],
      vaccines: [{ name: 'Gelbfieber', required: true }]
    })
    const [entry, vacc] = infoDocuments(i)
    expect(entry).toMatchObject({ title: 'Einreise Österreich – Visum nötig', status: 'fehlt' })
    expect(vacc).toMatchObject({ title: 'Impfschutz Österreich – Pflicht: Gelbfieber', status: 'fehlt' })
  })
})

describe('Länder', () => {
  it('erkennt Länder im Reiseziel', () => {
    expect(guessCountries('Gardasee, Italien')).toEqual(['IT'])
    expect(guessCountries('Rundreise Österreich und Schweiz')).toEqual(expect.arrayContaining(['AT', 'CH']))
    expect(guessCountries('Fusch')).toEqual([])
    expect(guessCountries('')).toEqual([])
  })
  it('Name und Flagge', () => {
    expect(countryName('AT')).toBe('Österreich')
    expect(flag('AT')).toBe('🇦🇹')
    expect(flag('x')).toBe('')
  })
})
