import { describe, expect, it } from 'vitest'
import { isOpen, missingVoters, optionsFromLines, summary, tally, toggleChoice, voteId } from '../logic'
import type { Poll, PollVote } from '../types'

const poll = (over: Partial<Poll> = {}): Poll => ({
  id: 'p1', tripId: 't1', question: 'Wohin?', notes: '', multiple: false, closed: false, deadline: '', createdBy: 'Marco', createdAt: '', updatedAt: '',
  options: [{ id: 'a', text: 'Bergsee' }, { id: 'b', text: 'Altstadt' }, { id: 'c', text: 'Therme' }],
  ...over
})
const vote = (voter: string, choices: string[], pollId = 'p1'): PollVote => ({ id: voteId(pollId, voter), tripId: 't1', pollId, voter, memberId: null, choices, createdAt: '', updatedAt: '' })

describe('Abstimmungen', () => {
  it('Antworten aus Zeilen: ohne Leerzeilen, Aufzählungszeichen und Doppelte', () => {
    let n = 0
    expect(optionsFromLines('- Bergsee\n\n• Altstadt\nbergsee\n  Therme  ', () => `o${++n}`)).toEqual([
      { id: 'o1', text: 'Bergsee' }, { id: 'o2', text: 'Altstadt' }, { id: 'o3', text: 'Therme' }
    ])
  })

  it('Auswahl: eine Antwort ersetzt, mehrere sammeln, erneut tippen nimmt zurück', () => {
    expect(toggleChoice(['a'], 'b', false)).toEqual(['b'])
    expect(toggleChoice(['a'], 'b', true)).toEqual(['a', 'b'])
    expect(toggleChoice(['a', 'b'], 'a', true)).toEqual(['b'])
    expect(toggleChoice(['a'], 'a', false)).toEqual([])
  })

  it('Ergebnis: Stimmen, Namen, Anteil, gleichauf vorne – fremde Abstimmungen und leere Stimmen zählen nicht', () => {
    const { results, voters } = tally(poll({ multiple: true }), [vote('Marco', ['a', 'b']), vote('Birgit', ['a']), vote('Kai', ['b']), vote('Lea', []), vote('Max', ['a'], 'p2')])
    expect(voters).toEqual(['Birgit', 'Kai', 'Marco'])
    expect(results.map((r) => [r.option.id, r.count, r.leading, Math.round(r.share * 100)])).toEqual([['a', 2, true, 67], ['b', 2, true, 67], ['c', 0, false, 0]])
    expect(results[0].voters).toEqual(['Birgit', 'Marco'])
    expect(tally(poll(), []).results.every((r) => !r.leading)).toBe(true)
  })

  it('offen bis zur Frist, fehlende Stimmen, Kurzfassung', () => {
    expect(isOpen(poll({ deadline: '2030-07-15' }), '2030-07-15')).toBe(true)
    expect(isOpen(poll({ deadline: '2030-07-15' }), '2030-07-16')).toBe(false)
    expect(isOpen(poll({ closed: true }), '2030-07-01')).toBe(false)
    expect(missingVoters(poll(), [vote('Marco', ['a'])], ['Marco', 'Birgit', 'Kind'])).toEqual(['Birgit', 'Kind'])
    expect(summary([], [], 'Marco', '2030-07-01')).toMatch(/Gemeinsam entscheiden/)
    expect(summary([poll(), poll({ id: 'p2' })], [vote('Marco', ['a'])], 'Marco', '2030-07-01')).toBe('2 offen · 1 wartet auf deine Stimme')
    expect(summary([poll({ closed: true })], [], 'Marco', '2030-07-01')).toBe('1 beendet')
  })
})
