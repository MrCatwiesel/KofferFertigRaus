import type { AppModule } from '@/core/registry'
import { todayIso } from '@/core/dates'
import { getMeta } from '@/core/meta'
import { myParticipant, people } from '@/core/people'
import { tripRepository } from '@/modules/trip/public'
import { pollRepository, voteRepository } from './repository'
import { summary } from './logic'
import { N_ } from '@/core/i18n'

/** Modul „Abstimmungen“: gemeinsam entscheiden – jede Person stimmt auf ihrem Gerät ab, abgeglichen über den Server. */
export const abstimmungModule: AppModule = {
  id: 'abstimmung',
  title: N_('Abstimmungen'),
  icon: 'check2-square',
  order: 36,
  routes: [{ path: '/trip/:tripId/abstimmungen', name: 'abstimmungen', component: () => import('./views/PollList.vue'), props: true }],
  tripSection: {
    phases: ['planung', 'unterwegs'],
    title: N_('Abstimmungen'),
    icon: 'check2-square',
    to: (tripId) => `/trip/${tripId}/abstimmungen`,
    async summary(tripId) {
      const [trip, polls, votes] = await Promise.all([tripRepository.get(tripId), pollRepository.listByTrip(tripId), voteRepository.listByTrip(tripId)])
      const me = people.me ? myParticipant(people, trip?.memberLinks) || people.me.name : await getMeta(`abstimmung.ich.${tripId}`, '')
      return summary(polls, votes, me, todayIso())
    }
  },
  onTripDelete: (tripId) => pollRepository.removeByTrip(tripId)
}
