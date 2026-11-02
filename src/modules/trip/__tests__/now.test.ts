import { describe, expect, it } from 'vitest'
import { nowCards, nowPhaseOf, relDay, type NowSection } from '../now'
import type { Reminder } from '@/core/reminders'

const S = (moduleId: string, summary = ''): NowSection => ({ moduleId, title: moduleId, icon: 'x', to: `/trip/t1/${moduleId}`, summary })
const ALL = ['packing', 'travel', 'accommodation', 'documents', 'checklisten', 'dayplanner', 'expenses', 'journal', 'map', 'report', 'website', 'termine'].map((id) => S(id, `${id}-info`))
const R = (id: string, date: string, extra: Partial<Reminder> = {}): Reminder => ({ id, tripId: 't1', date, title: `Frist ${id}`, kind: 'frist', ...extra }) as Reminder

describe('Jetzt wichtig', () => {
  it('Phase aus dem Datum', () => {
    const tp = { startDate: '2026-11-10', endDate: '2026-11-20' }
    expect(nowPhaseOf(tp, '2026-11-02')).toBe('vorher')
    expect(nowPhaseOf(tp, '2026-11-10')).toBe('unterwegs')
    expect(nowPhaseOf(tp, '2026-11-20')).toBe('unterwegs')
    expect(nowPhaseOf(tp, '2026-11-21')).toBe('danach')
    expect(nowPhaseOf({ ...tp, archived: true }, '2026-11-12')).toBe('danach')
  })
  it('vorher: die nächsten zwei Fristen, dann die Packliste – höchstens drei', () => {
    const cards = nowCards('vorher', ALL, [R('alt', '2026-11-01'), R('a', '2026-11-03', { to: '/trip/t1/unterkuenfte/1' }), R('b', '2026-11-06'), R('c', '2026-11-07')], '2026-11-02')
    expect(cards.map((c) => c.id)).toEqual(['r:a', 'r:b', 'packing'])
    expect(cards[0]).toMatchObject({ sub: 'morgen', to: '/trip/t1/unterkuenfte/1' })
    expect(cards[1]).toMatchObject({ sub: 'in 4 Tagen', to: '/trip/t1/termine' })
    expect(cards[2].sub).toBe('packing-info')
  })
  it('vorher ohne Fristen: Packliste, Anreise, Unterkunft', () => {
    expect(nowCards('vorher', ALL, [], '2026-11-02').map((c) => c.id)).toEqual(['packing', 'travel', 'accommodation'])
  })
  it('unterwegs: Heute, Frist von heute, Ausgabe erfassen', () => {
    const cards = nowCards('unterwegs', ALL, [R('h', '2026-11-12', { time: '10:00' })], '2026-11-12')
    expect(cards.map((c) => c.id)).toEqual(['dayplanner', 'r:h', 'expenses'])
    expect(cards[0].title).toBe('Heute')
    expect(cards[1].sub).toBe('heute · 10:00')
    expect(cards[2].to).toBe('/trip/t1/expenses/neu')
  })
  it('danach: Tagebuch, Bericht, Abrechnen; fehlende Bereiche werden übersprungen', () => {
    expect(nowCards('danach', ALL, [], '2026-12-01').map((c) => c.id)).toEqual(['journal', 'report', 'expenses'])
    expect(nowCards('danach', [S('expenses'), S('website')], [], '2026-12-01').map((c) => c.id)).toEqual(['expenses', 'website'])
  })
  it('relative Tage', () => {
    expect(relDay('2026-11-02', '2026-11-02')).toBe('heute')
    expect(relDay('2026-11-12', '2026-11-02')).toBe('in 10 Tagen')
  })
})
