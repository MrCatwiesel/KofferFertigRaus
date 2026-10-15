import type { AppModule } from '@/core/registry'
import { healthRepository } from './repository'
import { healthSummary } from './logic'
import { t } from '@/i18n'

/**
 * Modul „Gesundheit & Notfall“: Allergien, Erkrankungen und Blutgruppe je Person (abgeglichen, privat freigebbar),
 * Notfall-Seite mit Notruf und Karte in der Landessprache, Notfallkarte als PDF, Knopf in der Kopfzeile während der Reise.
 */
export const gesundheitModule: AppModule = {
  id: 'gesundheit',
  title: t('Gesundheit & Notfall'),
  icon: 'heart-pulse',
  order: 44,
  routes: [
    { path: '/trip/:tripId/gesundheit', name: 'health-edit', component: () => import('./views/HealthEdit.vue'), props: true },
    { path: '/trip/:tripId/sos', name: 'emergency', component: () => import('./views/EmergencyView.vue'), props: true }
  ],
  tripSection: {
    phases: ['planung', 'unterwegs'],
    title: t('Allergien & Gesundheit'),
    icon: 'heart-pulse',
    to: (tripId) => `/trip/${tripId}/dokumente?tab=gesundheit`,
    summary: async (tripId) => healthSummary(await healthRepository.listByTrip(tripId))
  },
  headerAction: () => import('./components/EmergencyButton.vue'),
  onTripDelete: (tripId) => healthRepository.removeByTrip(tripId),
  sampleData: (s) => import('./sample').then((m) => m.healthSample(s))
}
