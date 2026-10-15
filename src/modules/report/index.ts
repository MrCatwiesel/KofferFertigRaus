import type { AppModule } from '@/core/registry'
import { t } from '@/i18n'

/** Modul „Reisebericht“: Tagebuch, Fotos und Touren als Druckvorlage bzw. PDF / Fotobuch-Vorlage. */
export const reportModule: AppModule = {
  id: 'report',
  title: t('Reisebericht'),
  icon: 'file-earmark-richtext',
  order: 64,
  routes: [{ path: '/trip/:tripId/bericht', name: 'report', component: () => import('./views/ReportView.vue'), props: true }],
  tripSection: {
    phases: ['danach', 'teilen'],
    title: t('Reisebericht & Fotobuch (PDF)'),
    icon: 'file-earmark-richtext',
    to: (tripId) => `/trip/${tripId}/bericht`,
    summary: async () => t('Tagebuch, Fotos und Touren als PDF-Datei zum Teilen oder als Fotobuch')
  }
}
