import type { AppModule } from '@/core/registry'
import { tripRepository } from '@/modules/trip/public'
import { phrasebookSummary, tripLanguages } from './logic'
import { t } from '@/i18n'

/** Modul „Sprachführer“: wichtige Sätze in der Landessprache, offline, mit Vorlesen und Allergie-Karte. */
export const sprachfuehrerModule: AppModule = {
  id: 'sprachfuehrer',
  title: t('Sprachführer'),
  icon: 'translate',
  order: 46,
  routes: [{ path: '/trip/:tripId/sprachfuehrer', name: 'phrasebook', component: () => import('./views/PhrasebookView.vue'), props: true }],
  tripSection: {
    phases: ['planung', 'unterwegs'],
    title: t('Sprachführer'),
    icon: 'translate',
    to: (tripId) => `/trip/${tripId}/sprachfuehrer`,
    async summary(tripId) {
      const trip = await tripRepository.get(tripId)
      const countries = [...(trip?.countries ?? []), ...(trip?.transit ?? [])]
      // Die Sätze selbst erst mit der Seite laden – hier reicht die Liste der Sprachen
      const { LANGUAGES } = await import('./languages')
      return phrasebookSummary(tripLanguages(countries, LANGUAGES), countries.length > 0)
    }
  }
}
