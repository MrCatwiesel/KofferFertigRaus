import type { AppModule } from '@/core/registry'
import { todayIso } from '@/core/dates'
import { getMeta } from '@/core/meta'
import { myParticipant, people } from '@/core/people'
import { tripRepository } from '@/modules/trip/public'
import { isOpen, summaryText } from './logic'
import { pollRepository } from './repository'
import { pollSample } from './sample'

/** Modul „Abstimmungen“: gemeinsam entscheiden – jede Person stimmt auf ihrem Gerät ab. */
export const abstimmungModule: AppModule = {
  id: 'abstimmung',
  title: 'Abstimmungen',
  icon: 'hand-thumbs-up',
  order: 32,
  routes: [
    { path: '/trip/:tripId/abstimmungen', name: 'polls', component: () => import('./views/PollList.vue'), props: true },
    { path: '/trip/:tripId/abstimmungen/neu', name: 'poll-new', component: () => import('./views/PollEdit.vue'), props: true },
    { path: '/trip/:tripId/abstimmungen/:pollId', name: 'poll-edit', component: () => import('./views/PollEdit.vue'), props: true }
  ],
  tripSection: {
    phases: ['planung', 'unterwegs'],
    title: 'Abstimmungen',
    icon: 'hand-thumbs-up',
    to: (tripId) => `/trip/${tripId}/abstimmungen`,
    async summary(tripId) {
      const [polls, votes, trip] = await Promise.all([pollRepository.listByTrip(tripId), pollRepository.votesByTrip(tripId), tripRepository.get(tripId)])
      const me = myParticipant(people, trip?.memberLinks) || (await getMeta(`abstimmung.ich.${tripId}`, ''))
      return summaryText(polls, votes, me, todayIso())
    }
  },
  // Abstimmungsende als Frist (Termine & Fristen, Kalender, Push-Erinnerung)
  reminders: async (trip, today) =>
    (await pollRepository.listByTrip(trip.id))
      .filter((p) => p.deadline && isOpen(p, today))
      .map((p) => ({ id: `poll:${p.id}:ende`, tripId: trip.id, date: p.deadline, kind: 'frist' as const, title: `Abstimmung endet: ${p.question}`, to: `/trip/${trip.id}/abstimmungen` })),
  onTripDelete: (tripId) => pollRepository.removeByTrip(tripId),
  sampleData: pollSample
}
