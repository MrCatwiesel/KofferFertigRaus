import type { AppModule } from '@/core/registry'
import { N_ } from '@/core/i18n'

/** Modul „Reisebericht“: Tagebuch, Fotos und Touren als Druckvorlage bzw. PDF / Fotobuch-Vorlage. */
export const reportModule: AppModule = {
  id: 'report',
  title: N_('Reisebericht'),
  icon: 'file-earmark-richtext',
  order: 64,
  routes: [{ path: '/trip/:tripId/bericht', name: 'report', component: () => import('./views/ReportView.vue'), props: true }],
  tripSection: {
    phases: ['danach', 'teilen'],
    title: N_('Reisebericht & Fotobuch (PDF)'),
    icon: 'file-earmark-richtext',
    to: (tripId) => `/trip/${tripId}/bericht`,
    summary: async () => 'Tagebuch, Fotos und Touren als PDF-Datei zum Teilen oder als Fotobuch'
  }
}
