import { describe, expect, it } from 'vitest'
import { formatMoney } from '@/core/format'
import { applyDayDraft, composeDayDraft } from '../draft'
import { travelDayFacts } from '../../travel/day-facts'
import { activityDayFacts } from '../../activity/day-facts'
import { stayDayFacts } from '../../accommodation/day-facts'
import { expenseDayFacts } from '../../expenses/day-facts'
import { weatherDayFacts } from '../../dayplanner/day-facts'
import { routeDayFacts } from '../../routes/day-facts'
import type { TravelLeg } from '../../travel/types'
import type { Activity } from '../../activity/types'
import type { Accommodation } from '../../accommodation/types'
import type { Expense } from '../../expenses/types'

const D = '2026-10-05'
const leg = (o: Partial<TravelLeg>): TravelLeg => ({ id: 'l', tripId: 't', direction: 'hin', position: 0, mode: 'auto', from: 'München', to: 'Maria Alm', date: D, departTime: '08:00', arriveTime: '10:45', distanceKm: null, cost: null, currency: 'EUR', consumption: null, fuelPrice: null, tolls: null, bookingRef: '', url: '', notes: '', createdAt: '', updatedAt: '', ...o })
const act = (o: Partial<Activity>): Activity => ({ id: 'a', tripId: 't', title: 'X', category: 'natur', place: '', url: '', setting: 'aussen', priority: 2, durationHours: null, pricePerPerson: null, currency: 'EUR', openingHours: '', bookingRequired: false, status: 'erledigt', plannedDate: D, notes: '', createdAt: '', updatedAt: '', ...o })
const stay = (o: Partial<Accommodation>): Accommodation => ({ id: 's', tripId: 't', name: 'Hotel Morgenzeit', type: 'hotel', address: '', url: '', checkIn: '2026-10-04', checkOut: '2026-10-09', price: null, currency: 'EUR', status: 'gebucht', bookingRef: '', cancelUntil: '', notes: '', createdAt: '', updatedAt: '', ...o })
const exp = (amount: number, o: Partial<Expense> = {}): Expense => ({ id: 'e', tripId: 't', date: D, amount, currency: 'EUR', rate: 1, category: 'essen', description: '', paidBy: '', splitAmong: [], receipt: null, createdAt: '', updatedAt: '', ...o })

describe('Bausteine je Modul', () => {
  it('Anreise mit Etappen und Zeiten, Ort = Ziel', () => {
    const f = travelDayFacts([leg({}), leg({ position: 1, mode: 'bahn', from: 'Saalfelden', to: 'Maria Alm', departTime: '', arriveTime: '' }), leg({ date: '2026-10-09', direction: 'rueck' })], D)
    expect(f).toHaveLength(1)
    expect(f[0].text).toBe('Anreise: von München nach Maria Alm mit dem Auto (08:00–10:45 Uhr), dann von Saalfelden nach Maria Alm mit der Bahn.')
    expect(f[0]).toMatchObject({ title: 'Anreise', location: 'Maria Alm' })
  })
  it('Unternehmungen: erledigte vor geplanten, nach Wichtigkeit', () => {
    const f = activityDayFacts([act({ title: 'Kaiserschmarrn', priority: 3 }), act({ title: 'Hundstein', priority: 1, place: 'Hundstein, Thalgau' }), act({ title: 'Therme', status: 'geplant' }), act({ title: 'Alt', plannedDate: '2026-10-06' })], D)
    expect(f[0].text).toBe('Unternommen: Hundstein und Kaiserschmarrn.')
    expect(f[0]).toMatchObject({ title: 'Hundstein', location: 'Hundstein' })
    expect(activityDayFacts([act({ title: 'Therme', status: 'geplant' })], D)[0].text).toBe('Auf dem Plan: Therme.')
    expect(activityDayFacts([act({ status: 'verworfen' })], D)).toEqual([])
  })
  it('Unterkunft: Ankunft, Übernachtung, Umzug, Abreise', () => {
    expect(stayDayFacts([stay({})], '2026-10-04')[0].text).toBe('Angekommen in Hotel Morgenzeit.')
    expect(stayDayFacts([stay({})], D)[0].text).toBe('Übernachtung in Hotel Morgenzeit.')
    expect(stayDayFacts([stay({})], '2026-10-09')[0].text).toBe('Abschied von Hotel Morgenzeit.')
    expect(stayDayFacts([stay({ checkOut: D }), stay({ name: 'Almhütte', checkIn: D, checkOut: '2026-10-07' })], D).map((f) => f.text)).toEqual(['Umzug nach Almhütte.'])
    expect(stayDayFacts([stay({ status: 'storniert' })], D)).toEqual([])
  })
  it('Ausgaben des Tages in der Reisewährung', () => {
    expect(expenseDayFacts([exp(12.5), exp(20, { currency: 'CHF', rate: 1.05 }), exp(99, { date: '2026-10-06' })], D, 'EUR')[0].text).toBe(`Ausgaben: ${formatMoney(33.5, 'EUR')} (2 Posten).`)
  })
  it('Wetter nur, wenn der Tag in der Vorhersage steht', () => {
    const w = [{ date: D, code: 0, tempMin: 3.6, tempMax: 15.2, precipitation: 0, precipitationProbability: null, windMax: null }]
    expect(weatherDayFacts(w as never, D)[0].text).toBe('Wetter: Sonnig, 4 bis 15 °C.')
    expect(weatherDayFacts(w as never, '2026-10-06')).toEqual([])
    expect(weatherDayFacts(undefined, D)).toEqual([])
  })
  it('Touren: Strecke, Höhenmeter, Zeit, höchster Punkt; aufgezeichnete zuerst', () => {
    const stats = { distance: 12400, ascent: 812, descent: 812, minEle: 800, maxEle: 2117, start: null, end: null, duration: 16200 }
    const f = routeDayFacts([{ name: 'Plan', kind: 'route', date: D, stats }, { name: 'Hundstein', kind: 'track', date: D, stats }], D)
    expect(f[0].text).toBe('Tour „Hundstein“: 12,4 km, 812 Höhenmeter hinauf, 4 h 30 min unterwegs, höchster Punkt 2.117 m.')
    expect(f[0].title).toBe('Hundstein')
    expect(f[1].text).toMatch(/^Geplante Route „Plan“/)
  })
})

describe('Entwurf zusammensetzen', () => {
  const facts = [
    ...stayDayFacts([stay({})], D),
    ...routeDayFacts([{ name: 'Hundstein', kind: 'track', date: D, stats: { distance: 12400, ascent: 812, descent: 0, minEle: null, maxEle: null, start: null, end: null, duration: null } }], D),
    { order: 20, text: 'Wetter: Sonnig, 4 bis 15 °C.' },
    ...activityDayFacts([act({ title: 'Kaiserschmarrn', place: 'Maria Alm' })], D)
  ]
  it('Titel nach Rang, Ort, drei Absätze in fester Reihenfolge', () => {
    const d = composeDayDraft(facts, { dayNo: 2, destination: 'Maria Alm, Österreich' })
    expect(d.title).toBe('Hundstein') // Tour vor Unternehmung
    expect(d.location).toBe('Maria Alm')
    expect(d.text).toBe('Wetter: Sonnig, 4 bis 15 °C.\n\nUnternommen: Kaiserschmarrn. Tour „Hundstein“: 12,4 km, 812 Höhenmeter hinauf.\n\nÜbernachtung in Hotel Morgenzeit.')
    expect(d.facts).toBe(4)
  })
  it('ohne Bausteine: „Tag n“ und Reiseziel', () => {
    expect(composeDayDraft([], { dayNo: 3, destination: 'Maria Alm, Österreich' })).toEqual({ title: 'Tag 3', location: 'Maria Alm', text: '', facts: 0 })
  })
  it('vorhandenes bleibt, Text wird ergänzt, nicht doppelt', () => {
    const d = composeDayDraft(facts, { dayNo: 2, destination: '' })
    const once = applyDayDraft({ title: 'Mein Titel', location: '', text: 'Toller Tag!', mood: 5 }, d)
    expect(once).toMatchObject({ title: 'Mein Titel', location: 'Maria Alm', mood: 5 })
    expect(once.text.startsWith('Toller Tag!\n\nWetter:')).toBe(true)
    expect(applyDayDraft(once, d).text).toBe(once.text)
  })
})
