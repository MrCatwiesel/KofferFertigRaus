import { describe, expect, it } from 'vitest'
import { summarizeOutlook, type DailyWeather } from '@/services/weather'
import { draftsFromSuggestions, newSuggestions, suggestItems, type SuggestContext } from '../suggest'

const ctx = (over: Partial<SuggestContext> = {}): SuggestContext => ({
  days: 5, travelers: 2, participants: ['Marco', 'Birgit'], countries: [], transport: 'auto', legModes: [], outlook: null,
  activityCategories: [], activityText: '', hasRoutes: false, maxElevation: null, accommodationTypes: [], seaside: false, healthText: '', ...over
})
const keys = (c: Partial<SuggestContext>) => suggestItems(ctx(c)).map((s) => s.key)
const day = (over: Partial<DailyWeather>): DailyWeather => ({ date: '2025-10-04', code: 1, tempMax: 15, tempMin: 5, precipitation: 0, precipitationProbability: null, windMax: 10, ...over })

describe('Wetter-Aussicht', () => {
  it('fasst Tage zusammen', () => {
    const o = summarizeOutlook([day({ tempMin: -2, precipitation: 3 }), day({ tempMax: 21, code: 73 }), day({ windMax: 60 }), day({})], 'vorjahre', [2023, 2024, 2025])!
    expect(o).toMatchObject({ minTemp: -2, maxTemp: 21, rainShare: 0.25, snow: true, windy: true, days: 4, years: [2023, 2024, 2025] })
    expect(summarizeOutlook([], 'vorhersage')).toBeNull()
  })
})

describe('Packvorschläge', () => {
  it('Wetter: Regen, Kälte, Hitze', () => {
    const cold = summarizeOutlook([day({ tempMin: 1, precipitation: 5 }), day({ precipitation: 2 })], 'vorhersage')!
    expect(keys({ outlook: cold })).toEqual(expect.arrayContaining(['regenjacke', 'schirm', 'wasserdicht', 'muetze', 'handschuhe', 'winterjacke']))
    const hot = summarizeOutlook([day({ tempMax: 31, tempMin: 20 })], 'vorhersage')!
    const k = keys({ outlook: hot })
    expect(k).toEqual(expect.arrayContaining(['sonnencreme', 'sonnenhut', 'trinkflasche']))
    expect(k).not.toContain('pullover')
  })
  it('Zielland: Schweiz mit dem Auto, Großbritannien mit dem Flug', () => {
    const ch = suggestItems(ctx({ countries: ['CH'] }))
    expect(ch.map((s) => s.key)).toEqual(expect.arrayContaining(['stecker-CH', 'geld-CH', 'roaming-CH', 'vignette-CH', 'warnweste']))
    expect(ch.find((s) => s.key === 'geld-CH')!.name).toBe('Bargeld/Karte in Schweizer Franken (CHF)')
    expect(ch.find((s) => s.key === 'warnweste')!.quantity).toBe(2)
    const at = keys({ countries: ['AT'] })
    expect(at).toContain('vignette-AT')
    expect(at).not.toContain('geld-AT')
    expect(at).not.toContain('roaming-AT')
    const gb = keys({ countries: ['GB'], transport: 'flug' })
    expect(gb).toEqual(expect.arrayContaining(['stecker-GB', 'geld-GB', 'roaming-GB', 'fluessig', 'powerbank']))
    expect(gb).not.toContain('vignette-GB')
    expect(keys({ countries: ['FR'] })).toContain('critair')
  })
  it('Berge, Wasser, Camping, Malaria', () => {
    const k = keys({ hasRoutes: true, maxElevation: 2571, activityText: 'Seisenbergklamm, Baden im Zeller See', accommodationTypes: ['camping'], healthText: 'Es besteht ein Malariarisiko.' })
    expect(k).toEqual(expect.arrayContaining(['wanderschuhe', 'stoecke', 'funktionsjacke', 'sonnenbrille', 'badesachen', 'stirnlampe', 'schlafsack', 'muecken', 'moskitonetz']))
  })
  it('doppelte Regeln zusammengefasst', () => {
    const hot = summarizeOutlook([day({ tempMax: 30 })], 'vorhersage')!
    const list = suggestItems(ctx({ outlook: hot, maxElevation: 2000 }))
    const sb = list.filter((s) => s.key === 'sonnenbrille')
    expect(sb).toHaveLength(1)
    expect(sb[0].reason).toContain('Bergen')
  })
  it('schon Vorhandenes wird nicht vorgeschlagen', () => {
    const list = suggestItems(ctx({ countries: ['CH'], hasRoutes: true }))
    const left = newSuggestions(list, [{ name: 'Wanderschuhe' }, { name: 'Reisestecker-Adapter' }, { name: 'Rucksack (klein)' }])
    expect(left.map((s) => s.key)).not.toEqual(expect.arrayContaining(['wanderschuhe']))
    expect(left.map((s) => s.key)).not.toContain('stecker-CH')
    expect(left.map((s) => s.key)).toContain('vignette-CH')
  })
  it('persönliche Einträge je Person, mit Grund als Notiz', () => {
    const drafts = draftsFromSuggestions(suggestItems(ctx({ hasRoutes: true })).filter((s) => s.key === 'wanderschuhe' || s.key === 'rucksack'), ['Marco', 'Birgit'])
    expect(drafts.map((d) => [d.name, d.person])).toEqual([['Wanderschuhe', 'Marco'], ['Wanderschuhe', 'Birgit'], ['Tagesrucksack', '']])
    expect(drafts[0].notes).toBe('Routen geplant')
  })
})
