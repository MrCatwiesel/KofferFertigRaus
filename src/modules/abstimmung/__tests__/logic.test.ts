import { describe, expect, it } from 'vitest'
import { dayLabel, emptyPollDraft, isOpen, missingVoters, optionLabel, summaryText, tally, toggleChoice, usableOptions, validatePoll, winners } from '../logic'
import type { Poll, PollVote } from '../types'

const poll = (over: Partial<Poll> = {}): Poll => ({
  id: 'p1', tripId: 't1', question: 'Wohin?', kind: 'auswahl', multiple: false, deadline: '', closed: false, createdBy: 'Marco', note: '',
  options: [{ id: 'a', text: 'See' }, { id: 'b', text: 'Berg' }, { id: 'c', text: 'Stadt' }], createdAt: '', updatedAt: '', ...over
})
const vote = (voter: string, choices: string[]): PollVote => ({ id: `p1:${voter}`, pollId: 'p1', tripId: 't1', voter, choices, createdAt: '', updatedAt: '' })

describe('Abstimmungen', () => {
  it('Prüfen: Frage und zwei Antworten', () => {
    const d = emptyPollDraft('Marco')
    expect(validatePoll(d)).toEqual({ question: 'Bitte eine Frage eingeben.', options: 'Bitte mindestens zwei Antworten angeben.' })
    d.question = 'Wohin?'
    d.options[0].text = 'See'
    d.options[1].text = '  '
    expect(validatePoll(d).options).toBeTruthy()
    d.options[1].text = 'Berg'
    expect(validatePoll(d)).toEqual({})
    expect(usableOptions({ kind: 'termin', options: [{ id: 'x', text: 'früh' }, { id: 'y', text: '', date: '2026-07-02' }] })).toHaveLength(1)
  })

  it('Offen bis zur Frist oder bis zum Beenden', () => {
    expect(isOpen(poll(), '2026-07-02')).toBe(true)
    expect(isOpen(poll({ deadline: '2026-07-02' }), '2026-07-02')).toBe(true)
    expect(isOpen(poll({ deadline: '2026-07-02' }), '2026-07-03')).toBe(false)
    expect(isOpen(poll({ closed: true }), '2026-07-01')).toBe(false)
  })

  it('Auszählen, Gleichstand, gelöschte Antworten, Fehlende', () => {
    const votes = [vote('Marco', ['a']), vote('Birgit', ['b']), vote('Oma', ['a']), vote('Tom', ['weg'])]
    const t = tally(poll(), votes, ['Marco', 'Birgit', 'Oma'])
    expect(t.results.map((r) => [r.option.id, r.count, r.leading])).toEqual([['a', 2, true], ['b', 1, false], ['c', 0, false]])
    expect(t.voters).toEqual(['Marco', 'Birgit', 'Oma'])
    expect(t.results[0].share).toBeCloseTo(2 / 3)
    expect(t.results[0].voters).toEqual(['Marco', 'Oma'])
    expect(winners(poll(), [vote('Marco', ['a']), vote('Birgit', ['b'])]).map((o) => o.id)).toEqual(['a', 'b'])
    expect(winners(poll(), [])).toEqual([])
    expect(missingVoters(['Marco', 'Birgit', 'Oma'], [vote('Birgit', ['b'])])).toEqual(['Marco', 'Oma'])
  })

  it('Antippen: einfach und mehrfach', () => {
    expect(toggleChoice([], 'a', false)).toEqual(['a'])
    expect(toggleChoice(['a'], 'b', false)).toEqual(['b'])
    expect(toggleChoice(['a'], 'a', false)).toEqual([])
    expect(toggleChoice(['a'], 'b', true)).toEqual(['a', 'b'])
    expect(toggleChoice(['a', 'b'], 'a', true)).toEqual(['b'])
  })

  it('Beschriftung von Tagen und Unternehmungen', () => {
    expect(dayLabel('2026-07-18')).toBe('Sa 18.07.')
    expect(optionLabel({ id: 'x', text: 'vormittags', date: '2026-07-18' })).toBe('Sa 18.07. · vormittags')
    expect(optionLabel({ id: 'x', text: '', activityId: 'q' }, () => 'Gletschertour')).toBe('Gletschertour')
  })

  it('Kurzfassung', () => {
    expect(summaryText([], [], 'Marco', '2026-07-01')).toMatch(/Gemeinsam entscheiden/)
    expect(summaryText([poll(), poll({ id: 'p2' })], [vote('Marco', ['a'])], 'Marco', '2026-07-01')).toBe('2 offen · 1 wartet auf dich')
    expect(summaryText([poll({ closed: true })], [], 'Marco', '2026-07-01')).toBe('1 beendet')
  })
})
