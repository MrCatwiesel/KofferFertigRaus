/** Reine Funktionen der Abstimmungen (ohne Datenbank, ohne Vue). */
import type { Poll, PollDraft, PollOption, PollVote } from './types'
import { t, tn } from '@/i18n'

export const emptyPollDraft = (createdBy = ''): PollDraft => ({
  question: '',
  kind: 'auswahl',
  options: [newOption(), newOption()],
  multiple: false,
  deadline: '',
  closed: false,
  createdBy,
  note: ''
})

export function newOption(over: Partial<PollOption> = {}): PollOption {
  return { id: Math.random().toString(36).slice(2, 10), text: '', ...over }
}

/** Antworten ohne Inhalt fallen weg */
export const usableOptions = (p: Pick<PollDraft, 'kind' | 'options'>) =>
  p.options.filter((o) => (p.kind === 'termin' ? !!o.date : p.kind === 'unternehmung' ? !!o.activityId : !!o.text.trim()))

export function validatePoll(p: PollDraft): Partial<Record<'question' | 'options', string>> {
  const errors: Partial<Record<'question' | 'options', string>> = {}
  if (!p.question.trim()) errors.question = t('Bitte eine Frage eingeben.')
  if (usableOptions(p).length < 2) errors.options = p.kind === 'termin' ? t('Bitte mindestens zwei Tage angeben.') : t('Bitte mindestens zwei Antworten angeben.')
  return errors
}

/** Läuft die Abstimmung noch? (nicht beendet, Frist nicht vorbei) */
export const isOpen = (p: Pick<Poll, 'closed' | 'deadline'>, today: string) => !p.closed && (!p.deadline || today <= p.deadline)

export interface OptionResult {
  option: PollOption
  count: number
  voters: string[]
  /** Anteil an allen Abstimmenden (0–1) */
  share: number
  leading: boolean
}

/** Ergebnis: Stimmen je Antwort; Stimmen für gelöschte Antworten zählen nicht. Namen in der Reihenfolge `order` (Teilnehmer). */
export function tally(poll: Pick<Poll, 'options'>, allVotes: PollVote[], order: string[] = []): { results: OptionResult[]; voters: string[] } {
  const rank = (n: string) => (order.includes(n) ? order.indexOf(n) : order.length)
  const votes = [...allVotes].sort((a, b) => rank(a.voter) - rank(b.voter) || a.voter.localeCompare(b.voter, 'de'))
  const ids = new Set(poll.options.map((o) => o.id))
  const voters = votes.filter((v) => v.choices.some((c) => ids.has(c)) || v.choices.length === 0).map((v) => v.voter)
  const results = poll.options.map((option) => {
    const names = votes.filter((v) => v.choices.includes(option.id)).map((v) => v.voter)
    return { option, count: names.length, voters: names, share: voters.length ? names.length / voters.length : 0, leading: false }
  })
  const max = Math.max(0, ...results.map((r) => r.count))
  if (max > 0) for (const r of results) r.leading = r.count === max
  return { results, voters }
}

/** Gewinner (bei Gleichstand mehrere) */
export const winners = (poll: Pick<Poll, 'options'>, votes: PollVote[]) => tally(poll, votes).results.filter((r) => r.leading).map((r) => r.option)

/** Wer hat noch nicht abgestimmt? */
export function missingVoters(participants: string[], votes: PollVote[]): string[] {
  const done = new Set(votes.map((v) => v.voter))
  return participants.filter((p) => !done.has(p))
}

/** Neue Auswahl nach einem Antippen: einfach (eine Antwort, nochmal tippen = zurücknehmen) oder mehrfach */
export function toggleChoice(current: string[], optionId: string, multiple: boolean): string[] {
  const has = current.includes(optionId)
  if (multiple) return has ? current.filter((c) => c !== optionId) : [...current, optionId]
  return has ? [] : [optionId]
}

export const voteId = (pollId: string, voter: string) => `${pollId}:${voter}`

const WD = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']
/** „Sa 18.07.“ */
export function dayLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? '')
  if (!m) return iso ?? ''
  return `${WD[new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay()]} ${m[3]}.${m[2]}.`
}

/** Anzeige einer Antwort; `activityTitle` liefert den Namen der Unternehmung */
export function optionLabel(o: PollOption, activityTitle: (id: string) => string = () => ''): string {
  const base = o.date ? dayLabel(o.date) : o.activityId ? activityTitle(o.activityId) || t('Unternehmung') : ''
  return [base, o.text.trim()].filter(Boolean).join(' · ') || o.text
}

/** Kurzfassung für die Reiseseite */
export function summaryText(polls: Poll[], votes: PollVote[], me: string, today: string): string {
  const open = polls.filter((p) => isOpen(p, today))
  if (!polls.length) return t('Gemeinsam entscheiden: Ausflug, Tag, Restaurant …')
  if (!open.length) return t('{n} beendet', { n: polls.length })
  const mine = me ? open.filter((p) => !votes.some((v) => v.pollId === p.id && v.voter === me)).length : 0
  return [t('{n} offen', { n: open.length }), mine ? tn(mine, '1 wartet auf dich', '{n} warten auf dich') : ''].filter(Boolean).join(' · ')
}
