import type { AppModule } from '@/core/registry'
import { journalRepository, photoRepository } from './repository'
import { journalStats, photosForMap } from './logic'
import { routeRepository } from '@/modules/routes/public'
import { N_ } from '@/core/i18n'

/** Modul "Reisetagebuch" (Meilenstein M4). */
export const journalModule: AppModule = {
  id: 'journal',
  title: N_('Tagebuch'),
  icon: 'journal-richtext',
  order: 60,
  routes: [
    { path: '/trip/:tripId/tagebuch', name: 'journal-list', component: () => import('./views/JournalList.vue'), props: true },
    { path: '/trip/:tripId/tagebuch/neu', name: 'journal-new', component: () => import('./views/JournalEdit.vue'), props: true },
    { path: '/trip/:tripId/tagebuch/:id', name: 'journal-edit', component: () => import('./views/JournalEdit.vue'), props: true }
  ],
  tripSection: {
    phases: ['unterwegs', 'danach', 'teilen'],
    title: N_('Reisetagebuch'),
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
  // Fotos mit Aufnahmeort; ohne GPS-Daten aus den aufgezeichneten Touren zur Aufnahmezeit
  async mapPhotos(tripId) {
    const [photos, entries, routes] = await Promise.all([photoRepository.listByTrip(tripId), journalRepository.listByTrip(tripId), routeRepository.listByTrip(tripId)])
    return photosForMap(tripId, photos, entries, routes.filter((r) => r.kind === 'track').map((r) => r.points))
  },
  placePhoto: (photoId, pos) => photoRepository.setPlace(photoId, pos),
  onTripDelete: (tripId) => journalRepository.removeByTrip(tripId)
}
