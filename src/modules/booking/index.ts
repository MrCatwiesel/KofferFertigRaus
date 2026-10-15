import type { AppModule } from '@/core/registry'
import { t } from '@/i18n'

/** Modul „Buchung einlesen“: Bestätigungen (Text, PDF, E-Mail, Kalender) → Unterkunft, An-/Rückreise oder Beleg. */
export const bookingModule: AppModule = {
  id: 'booking',
  title: t('Buchung einlesen'),
  icon: 'file-earmark-arrow-down',
  order: 19,
  routes: [{ path: '/trip/:tripId/buchung', name: 'booking-import', component: () => import('./views/BookingImport.vue'), props: true }],
  tripSection: {
    phases: ['planung'],
    title: t('Buchung einlesen'),
    icon: 'file-earmark-arrow-down',
    to: (tripId) => `/trip/${tripId}/buchung`,
    summary: async () => t('Bestätigung als PDF, Mail oder Text → Unterkunft oder Fahrt eintragen')
  }
}
