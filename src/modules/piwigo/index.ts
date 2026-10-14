import type { AppModule } from '@/core/registry'
import { describeQueue } from './logic'
import { albumLinkRepository, uploadRepository } from './repository'
import { piwigoAvailable, queuePhotos, startUploader } from './uploader'
import { N_, t } from '@/core/i18n'

/** Modul "Piwigo": Fotos mit der eigenen Piwigo-Galerie verbinden (über den Abgleich-Server). */
export const piwigoModule: AppModule = {
  id: 'piwigo',
  title: N_('Piwigo'),
  icon: 'images',
  order: 62,
  routes: [{ path: '/trip/:tripId/piwigo', name: 'piwigo-trip', component: () => import('./views/PiwigoTrip.vue'), props: true }],
  tripSection: {
    phases: ['danach', 'teilen'],
    title: N_('Fotos in Piwigo'),
    icon: 'images',
    to: (tripId) => `/trip/${tripId}/piwigo`,
    async summary(tripId) {
      const [link, queue] = await Promise.all([albumLinkRepository.get(tripId), uploadRepository.listByTrip(tripId)])
      const parts = [link ? t('Album: {0}', [link.albumName]) : t('Kein Album verbunden')]
      const q = describeQueue(queue)
      if (q) parts.push(q)
      return parts.join(' · ')
    }
  },
  photoSource: {
    label: t('Aus Piwigo'),
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
