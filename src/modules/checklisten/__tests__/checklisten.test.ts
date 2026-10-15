import { describe, expect, it } from 'vitest'
import { checkinId, checklistReminders, checklistSummary, checkoutStays, itemsOf, missingTexts } from '../logic'
import { checkoutSuggestions, HOME_SUGGESTIONS } from '../suggestions'
import type { ChecklistItem } from '../types'

const trip = { id: 't1', title: 'Mallorca', destination: '', startDate: '2026-11-20', endDate: '2026-11-27' }
const item = (over: Partial<ChecklistItem>): ChecklistItem => ({ id: 'i', tripId: 't1', list: 'zuhause', ref: '', text: 'Herd aus', done: false, position: 0, createdAt: '', updatedAt: '', ...over })
const stay = (over = {}) => ({ id: 'a1', name: 'Finca', type: 'ferienwohnung', status: 'gebucht', checkOut: '2026-11-27', ...over })
const flight = (over = {}) => ({ id: 'l1', mode: 'flug', direction: 'hin', from: 'NUE', to: 'PMI', date: '2026-11-20', departTime: '06:40', ...over })

describe('Vorschläge', () => {
  it('je Art der Unterkunft passend, ohne doppelte', () => {
    expect(checkoutSuggestions('hotel')).toContain('Safe leeren')
    expect(checkoutSuggestions('ferienwohnung')).toContain('Müll entsorgen')
    expect(checkoutSuggestions('camping')).toContain('Gasflasche zudrehen')
    expect(checkoutSuggestions('hotel')).not.toContain('Müll entsorgen')
    expect(checkoutSuggestions('sonstiges').length).toBeGreaterThan(4)
    for (const list of [HOME_SUGGESTIONS, checkoutSuggestions('privat')]) expect(new Set(list).size).toBe(list.length)
  })
  it('übernimmt nur, was noch fehlt', () => {
    expect(missingTexts([item({ text: 'Herd aus' })], ['herd aus ', 'Fenster zu', 'Fenster zu', ''])).toEqual(['Fenster zu'])
  })
})

describe('Listen', () => {
  it('sortiert nach Position und trennt nach Unterkunft', () => {
    const items = [item({ id: 'b', position: 2 }), item({ id: 'a', position: 1 }), item({ id: 'c', list: 'auschecken', ref: 'a1' })]
    expect(itemsOf(items, 'zuhause').map((i) => i.id)).toEqual(['a', 'b'])
    expect(itemsOf(items, 'auschecken', 'a1').map((i) => i.id)).toEqual(['c'])
    expect(itemsOf(items, 'auschecken', 'a2')).toEqual([])
  })
  it('nur gebuchte Unterkünfte mit Abreisetag', () => {
    const list = checkoutStays([stay({ id: 'x', checkOut: '2026-11-25' }), stay({ id: 'y', status: 'idee' }), stay({ id: 'z', checkOut: '' }), stay()])
    expect(list.map((s) => s.id)).toEqual(['x', 'a1'])
  })
})

describe('Erinnerungen', () => {
  it('zu Hause: am Vortag, nur mit offenen Punkten und vor der Abreise', () => {
    const open = [item({ id: '1' }), item({ id: '2', done: true })]
    const [r] = checklistReminders(trip, '2026-11-10', open, [], [])
    expect(r).toMatchObject({ id: 'chk:t1:zuhause', date: '2026-11-19', kind: 'pruefen', title: 'Bevor es losgeht: 1 Punkt offen' })
    expect(checklistReminders(trip, '2026-11-21', open, [], [])).toEqual([])
    expect(checklistReminders(trip, '2026-11-10', [item({ done: true })], [], [])).toEqual([])
    expect(checklistReminders(trip, '2026-11-10', [], [], [])).toEqual([])
  })
  it('Auschecken: am Abreisetag, verschwindet wenn alles abgehakt', () => {
    const [r] = checklistReminders(trip, '2026-11-22', [], [stay()], [])
    expect(r).toMatchObject({ id: 'chk:a1:auschecken', date: '2026-11-27', title: 'Auschecken: Finca', detail: 'Checkliste vor der Abreise aus der Unterkunft' })
    const done = [item({ list: 'auschecken', ref: 'a1', done: true })]
    expect(checklistReminders(trip, '2026-11-22', done, [stay()], [])).toEqual([])
    const open = [item({ list: 'auschecken', ref: 'a1' }), item({ id: 'k', list: 'auschecken', ref: 'a1' })]
    expect(checklistReminders(trip, '2026-11-22', open, [stay()], [])[0].detail).toBe('2 Punkte offen')
    expect(checklistReminders(trip, '2026-11-28', [], [stay()], [])).toEqual([])
  })
  it('Online-Check-in: Vortag mit Uhrzeit, gleiche Kennung wie früher, weg wenn abgehakt', () => {
    const [r] = checklistReminders(trip, '2026-11-10', [], [], [flight(), flight({ id: 'l2', mode: 'auto' })])
    expect(r).toMatchObject({ id: 'leg:l1:checkin', date: '2026-11-19', time: '06:40', kind: 'frist', title: 'Online-Check-in: NUE → PMI' })
    const done = [item({ id: checkinId('t1', 'l1'), list: 'checkin', ref: 'l1', done: true })]
    expect(checklistReminders(trip, '2026-11-10', done, [], [flight()])).toEqual([])
  })
})

describe('Kurzfassung', () => {
  it('zeigt den Stand je Liste', () => {
    const items = [item({}), item({ id: 'x', done: true }), item({ id: checkinId('t1', 'l1'), list: 'checkin', ref: 'l1', done: true }), item({ id: 'y', list: 'auschecken', ref: 'a1' })]
    expect(checklistSummary(items, [stay()], [flight()], 't1')).toBe('Zu Hause 1/2 · Check-in 1/1 · Finca 0/1')
    expect(checklistSummary([], [], [], 't1')).toContain('Auschecken')
  })
})
