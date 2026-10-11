import type { AppModule } from '@/core/registry'
import { describeQueue } from './logic'
import { albumLinkRepository, uploadRepository } from './repository'
import { piwigoAvailable, queuePhotos, startUploader } from './uploader'

/** Modul "Piwigo": Fotos mit der eigenen Piwigo-Galerie verbinden (über den Abgleich-Server). */
export const piwigoModule: AppModule = {
  id: 'piwigo',
  title: 'Piwigo',
  icon: 'images',
  order: 62,
  routes: [{ path: '/trip/:tripId/piwigo', name: 'piwigo-trip', component: () => import('./views/PiwigoTrip.vue'), props: true }],
  tripSection: {
    title: 'Fotos in Piwigo',
    icon: 'images',
    to: (tripId) => `/trip/${tripId}/piwigo`,
    async summary(tripId) {
      const [link, queue] = await Promise.all([albumLinkRepository.get(tripId), uploadRepository.listByTrip(tripId)])
      const parts = [link ? `Album: ${link.albumName}` : 'Kein Album verbunden']
      const q = describeQueue(queue)
      if (q) parts.push(q)
      return parts.join(' · ')
    }
  },
  photoSource: {
    label: 'Aus Piwigo',
    icon: 'images',
    available: piwigoAvailable,
    component: () => import('./views/PiwigoPicker.vue')
  },
  onPhotosAdded: queuePhotos,
  onStart: startUploader,
  async onTripDelete(tripId) {
    await uploadRepository.removeByTrip(tripId)
    await albumLinkRepository.remove(tripId)
  }
}
