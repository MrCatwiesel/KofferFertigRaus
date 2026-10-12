import { describe, expect, it } from 'vitest'
import { buildSiteData, defaultSettings, esc, fileNameFor, paragraphs, rgbOf, safeColor, type EntryInput } from '../logic'
import { renderSite } from '../render'
import type { SitePhoto, WebsiteSettingsDraft } from '../types'
import { chooseActivities, chooseStays, toSiteStays } from '../sections'

const trip = { title: 'Sommer am Gardasee', destination: 'Gardasee', startDate: '2026-07-01', endDate: '2026-07-07', participants: ['Ich', 'Anna'] }
const photo = (w: number, h: number, caption = ''): SitePhoto => ({ src: 'data:image/jpeg;base64,AAAA', caption, width: w, height: h })
const entry = (over: Partial<EntryInput>): EntryInput => ({
  date: '2026-07-02', title: 'Tag am See', text: 'Schön.', mood: 5, location: 'Riva', highlight: true, photos: [], createdAt: '2026-07-02T10:00:00Z', ...over
})

describe('Hilfen', () => {
  it('maskiert HTML', () => {
    expect(esc(`<script>alert("x")</script> & 'y'`)).toBe('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;')
  })
  it('macht Absätze und Zeilenumbrüche', () => {
    expect(paragraphs('Eins\nZwei\n\nDrei <b>')).toBe('<p>Eins<br>Zwei</p>\n<p>Drei &lt;b&gt;</p>')
    expect(paragraphs('   ')).toBe('')
  })
  it('lässt nur gültige Farben zu', () => {
    expect(safeColor('#AABBCC')).toBe('#aabbcc')
    expect(safeColor('red;}</style><script>')).toBe('#0d6efd')
    expect(rgbOf('#ff8000')).toBe('255, 128, 0')
  })
  it('Dateiname ohne Umlaute und Sonderzeichen', () => {
    expect(fileNameFor('Sommer am Gardasee 2026!')).toBe('sommer-am-gardasee-2026.html')
    expect(fileNameFor('Grüße aus Köln & Düsseldorf')).toBe('gruesse-aus-koeln-duesseldorf.html')
    expect(fileNameFor('???')).toBe('reise.html')
  })
})

describe('buildSiteData', () => {
  const entries = [
    entry({ date: '2026-07-03', title: 'B', photos: [photo(600, 800)] }),
    entry({ date: '2026-07-02', title: 'A', photos: [photo(800, 600, 'See')] }),
    entry({ date: '2026-07-02', title: 'Kein Highlight', highlight: false })
  ]
  it('filtert Highlights, sortiert und gruppiert nach Tag', () => {
    const s = buildSiteData(trip, { ...defaultSettings(trip), onlyHighlights: true }, entries)
    expect(s.days.map((d) => [d.date, d.dayNumber, d.entries.map((e) => e.title)])).toEqual([
      ['2026-07-02', 2, ['A']],
      ['2026-07-03', 3, ['B']]
    ])
    expect(s.stats).toEqual({ days: 7, entries: 2, photos: 2 })
  })
  it('alle Einträge, wenn gewünscht', () => {
    const s = buildSiteData(trip, { ...defaultSettings(trip), onlyHighlights: false }, entries)
    expect(s.stats.entries).toBe(3)
  })
  it('Titelbild: erstes Querformat', () => {
    const s = buildSiteData(trip, defaultSettings(trip), entries)
    expect(s.cover?.caption).toBe('See')
  })
})

describe('renderSite', () => {
  const base: WebsiteSettingsDraft = { ...defaultSettings(trip), title: 'Unser <Sommer>', accent: '#be123c' }
  const site = () => buildSiteData(trip, base, [entry({ text: 'Text mit </script>', photos: [photo(800, 600, 'Blick "aufs" Wasser')] })], '2026-08-01T00:00:00Z')

  it('erzeugt ein vollständiges, sicheres Dokument', () => {
    const html = renderSite(site(), base, '/*bootstrap*/')
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<title>Unser &lt;Sommer&gt;</title>')
    expect(html).toContain('/*bootstrap*/')
    expect(html).toContain('--accent: #be123c')
    expect(html).toContain('Text mit &lt;/script&gt;')
    expect(html).toContain('alt="Blick &quot;aufs&quot; Wasser"')
    expect(html).toContain('data-bs-theme="light"')
    // Nur ein echtes </script> – das der Fotoansicht
    expect(html.split('</script>').length).toBe(2)
  })

  it('alle Vorlagen zeichnen Titel und Eintrag', () => {
    for (const template of ['klassisch', 'magazin', 'galerie'] as const) {
      const html = renderSite(site(), { ...base, template, dark: true }, '')
      expect(html).toContain('Unser &lt;Sommer&gt;')
      expect(html).toContain('Tag am See')
      expect(html).toContain('data-bs-theme="dark"')
      expect(html).toContain('Erstellt mit „Nix wie weg“')
    }
  })

  it('Stimmung und Ort lassen sich ausblenden', () => {
    const shown = renderSite(site(), base, '')
    expect(shown).toContain('😍')
    expect(shown).toContain('Riva')
    const hidden = renderSite(site(), { ...base, showMood: false, showLocation: false }, '')
    expect(hidden).not.toContain('😍')
    expect(hidden).not.toContain('📍 Riva')
  })
})

describe('Routen auf der Webseite', () => {
  const route = (date: string, name = 'Monte Baldo') => ({
    name, color: '#16a34a', kind: 'track' as const, date,
    stats: { distance: 12345, ascent: 850, descent: 840, duration: 14400 },
    points: [[45.7, 10.8, 1000], [45.71, 10.81, 1500], [45.72, 10.8, 1800]] as [number, number, number | null][]
  })

  it('ordnet Routen ihrem Tag zu, auch Tagen ohne Eintrag; ohne Tag oben', () => {
    const s = buildSiteData(trip, { ...defaultSettings(trip), onlyHighlights: false }, [entry({ date: '2026-07-02' })], '2026-08-01T00:00:00Z', [
      route('2026-07-04'),
      route('', 'Anreise')
    ])
    expect(s.days.map((d) => d.date)).toEqual(['2026-07-02', '2026-07-04'])
    expect(s.days[1].routes[0].name).toBe('Monte Baldo')
    expect(s.days[1].dayNumber).toBe(4)
    expect(s.routes[0].name).toBe('Anreise')
  })

  it('zeichnet Strecke und Höhenprofil in allen Vorlagen', () => {
    const s = buildSiteData(trip, defaultSettings(trip), [], '2026-08-01T00:00:00Z', [route('2026-07-04')])
    for (const template of ['klassisch', 'magazin', 'galerie'] as const) {
      const html = renderSite(s, { ...defaultSettings(trip), template }, '')
      expect(html).toContain('Monte Baldo')
      expect(html).toContain('nww-track')
      expect(html).toContain('nww-profile')
      expect(html).toContain('12,3 km')
    }
  })
})

describe('Bereiche: Unterkünfte, Unternehmungen, Fotos, Mitreisende', () => {
  const stays = [
    { name: 'Hotel Lido', type: 'hotel', checkIn: '2026-07-01', checkOut: '2026-07-04', address: 'Via Roma 1', url: 'https://lido.example', status: 'gebucht' },
    { name: 'Idee', type: 'camping', checkIn: '', checkOut: '', status: 'idee' },
    { name: 'Weg', type: 'hostel', checkIn: '2026-07-04', checkOut: '2026-07-05', status: 'storniert' }
  ]
  const acts = [
    { title: 'Bootsfahrt', category: 'natur', date: '2026-07-03', place: 'Hafen', status: 'erledigt' },
    { title: 'Klettern', category: 'aktiv', date: '', status: 'idee' }
  ]
  it('wählt gebuchte Unterkünfte und erledigte Unternehmungen', () => {
    expect(chooseStays(stays).map((s) => s.name)).toEqual(['Hotel Lido'])
    expect(chooseStays(stays.slice(1)).map((s) => s.name)).toEqual(['Idee'])
    expect(chooseActivities(acts).map((a) => a.title)).toEqual(['Bootsfahrt'])
    expect(chooseActivities([{ title: 'X', status: 'geplant' }, { title: 'Y', status: 'idee' }]).map((a) => a.title)).toEqual(['X'])
  })
  it('Adresse und Link nur auf Wunsch, Nächte gezählt', () => {
    const [plain] = toSiteStays(stays, false)
    expect(plain).toMatchObject({ name: 'Hotel Lido', type: 'Hotel', nights: 3, address: '', url: '' })
    expect(toSiteStays(stays, true)[0]).toMatchObject({ address: 'Via Roma 1', url: 'https://lido.example' })
    expect(toSiteStays([{ ...stays[0], url: 'javascript:alert(1)' }], true)[0].url).toBe('')
  })
  it('buildSiteData beachtet die Auswahl', () => {
    const entries = [entry({ photos: [photo(800, 600)] })]
    const extra = { stays: chooseStays(stays), activities: chooseActivities(acts) }
    const on = buildSiteData(trip, { ...defaultSettings(trip), showActivities: true }, entries, undefined, [], extra)
    expect(on.stays.map((s) => s.name)).toEqual(['Hotel Lido'])
    expect(on.activities.map((a) => a.title)).toEqual(['Bootsfahrt'])
    expect(on.participants).toEqual(['Ich', 'Anna'])
    const off = buildSiteData(
      trip,
      { ...defaultSettings(trip), showStays: false, showPhotos: false, showParticipants: false },
      entries,
      undefined,
      [],
      extra
    )
    expect([off.stays, off.activities, off.participants, off.stats.photos, off.cover]).toEqual([[], [], [], 0, null])
    // Ältere Einstellungen ohne die neuen Felder: Unterkünfte an, Unternehmungen aus
    const old = buildSiteData(trip, { title: 'T', subtitle: '', intro: '', author: '', onlyHighlights: true }, entries, undefined, [], extra)
    expect([old.stays.length, old.activities.length]).toEqual([1, 0])
  })
  it('zeichnet Unterkünfte und Unternehmungen in allen Vorlagen', () => {
    const site = buildSiteData(trip, { ...defaultSettings(trip), showActivities: true }, [entry({})], '2026-08-01T00:00:00Z', [], {
      stays: [{ ...stays[0], name: 'Hotel <Lido>' }],
      activities: acts.slice(0, 1)
    })
    for (const template of ['klassisch', 'magazin', 'galerie'] as const) {
      const html = renderSite(site, { ...defaultSettings(trip), template }, '')
      expect(html).toContain('Hotel &lt;Lido&gt;')
      expect(html).toContain('3 Nächte')
      expect(html).toContain('Bootsfahrt')
    }
  })
})
