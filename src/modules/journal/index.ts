import type { AppModule } from '@/core/registry'
import { journalRepository, photoRepository } from './repository'
import { journalStats } from './logic'

/** Modul "Reisetagebuch" (Meilenstein M4). */
export const journalModule: AppModule = {
  id: 'journal',
  title: 'Tagebuch',
  icon: 'journal-richtext',
  order: 60,
  routes: [
    { path: '/trip/:tripId/tagebuch', name: 'journal-list', component: () => import('./views/JournalList.vue'), props: true },
    { path: '/trip/:tripId/tagebuch/neu', name: 'journal-new', component: () => import('./views/JournalEdit.vue'), props: true },
    { path: '/trip/:tripId/tagebuch/:id', name: 'journal-edit', component: () => import('./views/JournalEdit.vue'), props: true }
  ],
  tripSection: {
    phases: ['unterwegs', 'danach', 'teilen'],
    title: 'Reisetagebuch',
    icon: 'journal-richtext',
    to: (tripId) => `/trip/${tripId}/tagebuch`,
    async summary(tripId) {
      const [entries, photos] = await Promise.all([journalRepository.listByTrip(tripId), photoRepository.countByTrip(tripId)])
      if (entries.length === 0) return 'Noch keine Einträge'
      const s = journalStats(entries, photos)
      const parts = [`${s.entries} ${s.entries === 1 ? 'Eintrag' : 'Einträge'}`, `${s.photos} Fotos`]
      if (s.highlights) parts.push(`${s.highlights} Highlights`)
      return parts.join(' · ')
    }
  },
  coverPhotos: async (tripId) =>
    (await photoRepository.listByTrip(tripId)).map((p) => ({ id: p.id, thumb: p.thumb, full: p.full, caption: p.caption })),
  onTripDelete: (tripId) => journalRepository.removeByTrip(tripId)
}
