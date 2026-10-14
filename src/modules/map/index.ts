import type { AppModule } from '@/core/registry'
import { accommodationRepository } from '@/modules/accommodation/public'
import { activityRepository } from '@/modules/activity/public'
import { placeRepository } from './repository'
import { offlineMapRepository } from './offline'
import { N_, t } from '@/core/i18n'

/** Modul "Karte". */
export const mapModule: AppModule = {
  id: 'map',
  title: N_('Karte'),
  icon: 'map',
  order: 14,
  routes: [{ path: '/trip/:tripId/karte', name: 'map', component: () => import('./views/MapView.vue'), props: true }],
  tripSection: {
    phases: ['planung', 'unterwegs'],
    title: N_('Karte'),
    icon: 'map',
    to: (tripId) => `/trip/${tripId}/karte`,
    async summary(tripId) {
      const [accs, acts, places] = await Promise.all([
        accommodationRepository.listByTrip(tripId),
        activityRepository.listByTrip(tripId),
        placeRepository.listByTrip(tripId)
      ])
      const total = accs.filter((a) => a.status !== 'storniert').length + acts.filter((a) => a.status !== 'verworfen').length
      if (total === 0) return t('Unterkünfte und Unternehmungen auf der Karte')
      return t('{0} von {1} Orten auf der Karte', [places.length, total])
    }
  },
  onTripDelete: async (tripId) => {
    await placeRepository.removeByTrip(tripId)
    await offlineMapRepository.removeByTrip(tripId)
  }
}
