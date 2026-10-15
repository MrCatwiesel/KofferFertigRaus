import type { AppModule } from '@/core/registry'
import { tripRepository } from '@/modules/trip/public'
import { sheetCountries, sheetSummary } from './logic'
import { t } from '@/i18n'

/** Modul „Länder-Spickzettel“: Strom, Notruf, Zeit, Trinkgeld, Wasser und Verkehrsregeln je Ziel- und Durchreiseland – offline. */
export const laenderModule: AppModule = {
  id: 'laender',
  title: t('Länder-Spickzettel'),
  icon: 'card-checklist',
  order: 47,
  routes: [{ path: '/trip/:tripId/laender', name: 'laender', component: () => import('./views/LaenderView.vue'), props: true }],
  tripSection: {
    phases: ['planung', 'unterwegs'],
    title: t('Länder-Spickzettel'),
    icon: 'card-checklist',
    to: (tripId) => `/trip/${tripId}/laender`,
    async summary(tripId) {
      return sheetSummary(sheetCountries(await tripRepository.get(tripId)))
    }
  }
}
