/** Reine Funktionen für Abstimmungen (ohne Datenbank und Vue). */
import type { Poll, PollOption, PollVote } from './types'
import { t } from '@/core/i18n'

/** Kennung der Stimme: je Abstimmung und Name genau eine */
export const voteId = (pollId: string, voter: string) => `${pollId}:${voter.trim().replace(/\s+/g, ' ')}`

/** Antworten aus Zeilen („eine pro Zeile“), ohne Leerzeilen und Doppelte */
export function optionsFromLines(text: string, makeId: () => string): PollOption[] {
  const seen = new Set<string>()
  const out: PollOption[] = []
  for (const line of text.split('\n')) {
    const t = line.trim().replace(/^[-•*]\s*/, '').slice(0, 200)
    if (!t || seen.has(t.toLowerCase())) continue
    seen.add(t.toLowerCase())
    out.push({ id: makeId(), text: t })
  }
  return out
}

/** Auswahl umschalten: bei einer Antwort ersetzt sie die bisherige */
export function toggleChoice(choices: string[], optionId: string, multiple: boolean): string[] {
  if (choices.includes(optionId)) return choices.filter((c) => c !== optionId)
  return multiple ? [...choices, optionId] : [optionId]
}

export interface OptionResult {
  option: PollOption
  count: number
  voters: string[]
  /** Anteil an allen, die abgestimmt haben (0–1) */
  share: number
  leading: boolean
}

/** Ergebnis: Stimmen je Antwort, Namen, vorne liegende Antworten (gleichauf = mehrere) */
export function tally(poll: Poll, votes: PollVote[]): { results: OptionResult[]; voters: string[] } {
  const mine = votes.filter((v) => v.pollId === poll.id && v.choices.length)
  const ids = new Set(poll.options.map((o) => o.id))
  const results = poll.options.map((option) => {
    const voters = mine.filter((v) => v.choices.includes(option.id)).map((v) => v.voter).sort((a, b) => a.localeCompare(b, 'de'))
    return { option, count: voters.length, voters, share: 0, leading: false }
  })
  const voters = mine.filter((v) => v.choices.some((c) => ids.has(c))).map((v) => v.voter).sort((a, b) => a.localeCompare(b, 'de'))
  const max = Math.max(0, ...results.map((r) => r.count))
  for (const r of results) {
    r.share = voters.length ? r.count / voters.length : 0
    r.leading = max > 0 && r.count === max
  }
  return { results, voters }
}

/** Noch offen? (nicht beendet, Frist nicht vorbei) */
export const isOpen = (poll: Poll, today: string) => !poll.closed && (!poll.deadline || poll.deadline >= today)

/** Teilnehmer, die bei einer offenen Abstimmung noch nicht abgestimmt haben */
export function missingVoters(poll: Poll, votes: PollVote[], participants: string[]): string[] {
  const done = new Set(votes.filter((v) => v.pollId === poll.id && v.choices.length).map((v) => v.voter))
  return participants.filter((p) => !done.has(p))
}

/** Kurzfassung für die Reiseseite */
export function summary(polls: Poll[], votes: PollVote[], me: string, today: string): string {
  const open = polls.filter((p) => isOpen(p, today))
  if (!polls.length) return t('Gemeinsam entscheiden: Ziel, Restaurant, Ausflug …')
  if (!open.length) return t('{0} beendet', [polls.length])
  const waiting = me ? open.filter((p) => !votes.some((v) => v.pollId === p.id && v.voter === me && v.choices.length)).length : 0
  return [t('{0} offen', [open.length]), waiting ? t('{0} wartet auf deine Stimme', [waiting]) : ''].filter(Boolean).join(' · ')
}
