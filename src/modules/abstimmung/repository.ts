import { db, newId, now } from '@/core/db'
import type { Poll, PollDraft, PollVote } from './types'
import { voteId } from './logic'
import { t } from '@/core/i18n'

export const pollRepository = {
  listByTrip(tripId: string): Promise<Poll[]> {
    return db.polls.where('tripId').equals(tripId).toArray()
  },
  get(id: string): Promise<Poll | undefined> {
    return db.polls.get(id)
  },
  async create(tripId: string, draft: PollDraft, createdBy: string): Promise<string> {
    const ts = now()
    const poll: Poll = { ...draft, id: newId(), tripId, closed: false, createdBy, createdAt: ts, updatedAt: ts }
    await db.polls.add(poll)
    return poll.id
  },
  async update(id: string, changes: Partial<PollDraft & Pick<Poll, 'closed'>>): Promise<void> {
    await db.polls.update(id, { ...changes, updatedAt: now() })
  },
  /** Abstimmung samt Stimmen löschen */
  async remove(id: string): Promise<void> {
    await db.transaction('rw', db.polls, db.pollVotes, async () => {
      await db.pollVotes.where('pollId').equals(id).delete()
      await db.polls.delete(id)
    })
  },
  async removeByTrip(tripId: string): Promise<void> {
    await db.pollVotes.where('tripId').equals(tripId).delete()
    await db.polls.where('tripId').equals(tripId).delete()
  }
}

export const voteRepository = {
  listByTrip(tripId: string): Promise<PollVote[]> {
    return db.pollVotes.where('tripId').equals(tripId).toArray()
  },
  /** Eigene Stimme setzen; ohne Auswahl wird sie zurückgezogen */
  async set(poll: Poll, voter: string, memberId: string | null, choices: string[]): Promise<void> {
    const id = voteId(poll.id, voter)
    if (!choices.length) return void (await db.pollVotes.delete(id))
    const old = await db.pollVotes.get(id)
    const ts = now()
    await db.pollVotes.put({ id, tripId: poll.tripId, pollId: poll.id, voter, memberId, choices, createdAt: old?.createdAt ?? ts, updatedAt: ts })
  },
  /** Alle Stimmen einer Abstimmung löschen (neu abstimmen) */
  async clear(pollId: string): Promise<void> {
    await db.pollVotes.where('pollId').equals(pollId).delete()
  }
}
