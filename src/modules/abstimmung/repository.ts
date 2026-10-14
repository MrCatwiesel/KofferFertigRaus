import { db, newId, now } from '@/core/db'
import { voteId } from './logic'
import type { Poll, PollDraft, PollVote } from './types'

/** Kopie ohne Vue-Hüllen (sonst scheitert das Speichern in IndexedDB still) */
const plain = <T>(x: T): T => JSON.parse(JSON.stringify(x))

/** Datenzugriff des Moduls „Abstimmungen“. */
export const pollRepository = {
  listByTrip(tripId: string): Promise<Poll[]> {
    return db.polls.where('tripId').equals(tripId).toArray()
  },

  get(id: string): Promise<Poll | undefined> {
    return db.polls.get(id)
  },

  async create(tripId: string, draft: PollDraft): Promise<string> {
    const ts = now()
    const poll: Poll = { ...plain(draft), id: newId(), tripId, createdAt: ts, updatedAt: ts }
    await db.polls.add(poll)
    return poll.id
  },

  async update(id: string, draft: PollDraft): Promise<void> {
    await db.polls.update(id, { ...plain(draft), updatedAt: now() })
  },

  async setClosed(id: string, closed: boolean): Promise<void> {
    await db.polls.update(id, { closed, updatedAt: now() })
  },

  async remove(id: string): Promise<void> {
    await db.transaction('rw', db.polls, db.pollVotes, async () => {
      await db.pollVotes.where('pollId').equals(id).delete()
      await db.polls.delete(id)
    })
  },

  votesByTrip(tripId: string): Promise<PollVote[]> {
    return db.pollVotes.where('tripId').equals(tripId).toArray()
  },

  /** Stimme abgeben oder ändern (`null` = Stimme zurückziehen) */
  async setVote(poll: Pick<Poll, 'id' | 'tripId'>, voter: string, choices: string[] | null): Promise<void> {
    const id = voteId(poll.id, voter)
    if (choices === null) return db.pollVotes.delete(id)
    const old = await db.pollVotes.get(id)
    const ts = now()
    await db.pollVotes.put({ id, pollId: poll.id, tripId: poll.tripId, voter, choices: [...choices], createdAt: old?.createdAt ?? ts, updatedAt: ts })
  },

  async removeByTrip(tripId: string): Promise<void> {
    await db.transaction('rw', db.polls, db.pollVotes, async () => {
      await db.pollVotes.where('tripId').equals(tripId).delete()
      await db.polls.where('tripId').equals(tripId).delete()
    })
  }
}
