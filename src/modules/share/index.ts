import type { AppModule } from '@/core/registry'
import { t } from '@/i18n'

/** Modul "Lese-Links": Reisen für Freunde zum Ansehen freigeben (über den eigenen Server). */
export const shareModule: AppModule = {
  id: 'share',
  title: t('Für Freunde freigeben'),
  icon: 'eye',
  order: 72,
  routes: [{ path: '/trip/:tripId/freigabe', name: 'share-links', component: () => import('./views/ShareLinks.vue'), props: true }],
  tripSection: {
    phases: ['teilen'],
    title: t('Für Freunde freigeben'),
    icon: 'eye',
    to: (tripId) => `/trip/${tripId}/freigabe`,
    summary: async () => t('Lese-Links: ansehen, nicht ändern')
  }
}
