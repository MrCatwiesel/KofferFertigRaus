import type { AppModule } from '@/core/registry'

/** Modul „Buchung einlesen“: Bestätigungen (Text, PDF, E-Mail, Kalender) → Unterkunft, An-/Rückreise oder Beleg. */
export const bookingModule: AppModule = {
  id: 'booking',
  title: 'Buchung einlesen',
  icon: 'file-earmark-arrow-down',
  order: 19,
  routes: [{ path: '/trip/:tripId/buchung', name: 'booking-import', component: () => import('./views/BookingImport.vue'), props: true }],
  tripSection: {
    phases: ['planung'],
    title: 'Buchung einlesen',
    icon: 'file-earmark-arrow-down',
    to: (tripId) => `/trip/${tripId}/buchung`,
    summary: async () => 'Bestätigung als PDF, Mail oder Text → Unterkunft oder Fahrt eintragen'
  }
}
