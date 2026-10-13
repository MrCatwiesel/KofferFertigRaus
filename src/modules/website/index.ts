import type { AppModule } from '@/core/registry'
import { journalRepository } from '@/modules/journal/public'
import { websiteRepository } from './repository'
import { TEMPLATE_INFO } from './types'

/** Modul "Reise-Webseite" (Meilenstein M5). */
export const websiteModule: AppModule = {
  id: 'website',
  title: 'Reise-Webseite',
  icon: 'globe2',
  order: 70,
  routes: [
    { path: '/trip/:tripId/webseite', name: 'website', component: () => import('./views/WebsiteEditor.vue'), props: true }
  ],
  tripSection: {
    phases: ['teilen'],
    title: 'Reise-Webseite',
    icon: 'globe2',
    to: (tripId) => `/trip/${tripId}/webseite`,
    async summary(tripId) {
      const [settings, entries] = await Promise.all([websiteRepository.get(tripId), journalRepository.listByTrip(tripId)])
      const highlights = entries.filter((e) => e.highlight).length
      if (entries.length === 0) return 'Entsteht aus dem Tagebuch'
      const tpl = settings ? TEMPLATE_INFO[settings.template].title : 'noch nicht eingerichtet'
      return `Vorlage: ${tpl} · ${highlights} Highlights`
    }
  },
  onTripDelete: (tripId) => websiteRepository.remove(tripId)
}
