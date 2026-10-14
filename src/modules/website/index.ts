import type { AppModule } from '@/core/registry'
import { journalRepository } from '@/modules/journal/public'
import { websiteRepository } from './repository'
import { TEMPLATE_INFO } from './types'
import { N_, t } from '@/core/i18n'

/** Modul "Reise-Webseite" (Meilenstein M5). */
export const websiteModule: AppModule = {
  id: 'website',
  title: N_('Reise-Webseite'),
  icon: 'globe2',
  order: 70,
  routes: [
    { path: '/trip/:tripId/webseite', name: 'website', component: () => import('./views/WebsiteEditor.vue'), props: true }
  ],
  tripSection: {
    phases: ['teilen'],
    title: N_('Reise-Webseite'),
    icon: 'globe2',
    to: (tripId) => `/trip/${tripId}/webseite`,
    async summary(tripId) {
      const [settings, entries] = await Promise.all([websiteRepository.get(tripId), journalRepository.listByTrip(tripId)])
      const highlights = entries.filter((e) => e.highlight).length
      if (entries.length === 0) return t('Entsteht aus dem Tagebuch')
      const tpl = settings ? TEMPLATE_INFO[settings.template].title : t('noch nicht eingerichtet')
      return t('Vorlage: {0} · {1} Highlights', [tpl, highlights])
    }
  },
  onTripDelete: (tripId) => websiteRepository.remove(tripId)
}
