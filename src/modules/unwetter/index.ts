import type { AppModule } from '@/core/registry'
import { syncState } from '@/core/sync/engine'
import { tripRepository } from '@/modules/trip/public'
import { getCache, refreshIfStale, removeCache } from './api'
import { startWatchUpload } from './beobachten'
import { settingsOf, summaryText } from './logic'
import { t } from '@/i18n'

/** Modul „Unwetterwarnungen“: amtliche Warnungen (MeteoAlarm) für die Orte der Reise – auch als Push-Benachrichtigung. */
export const unwetterModule: AppModule = {
  id: 'unwetter',
  title: t('Unwetterwarnungen'),
  icon: 'cloud-lightning-rain',
  order: 49,
  routes: [{ path: '/trip/:tripId/unwetter', name: 'unwetter', component: () => import('./views/UnwetterView.vue'), props: true }],
  tripSection: {
    phases: ['planung', 'unterwegs'],
    title: t('Unwetterwarnungen'),
    icon: 'cloud-lightning-rain',
    to: (tripId) => `/trip/${tripId}/unwetter`,
    async summary(tripId) {
      void refreshIfStale(tripId).catch(() => undefined) // im Hintergrund aktuell halten
      const trip = await tripRepository.get(tripId)
      if (!trip?.countries?.length) return t('Zielland angeben → amtliche Warnungen vor Sturm, Gewitter, Hitze …')
      if (settingsOf(trip).scope === 'aus') return t('Ausgeschaltet')
      if (!syncState.configured) return t('Braucht den eigenen Server (Geräte-Abgleich)')
      const cache = await getCache(tripId)
      if (!cache) return t('Noch nicht abgerufen')
      if (!cache.countries.length && cache.errors.length) return cache.errors.every((e) => e.unsupported) ? t('Für dieses Zielland gibt es keine Warnungen von MeteoAlarm') : t('Zuletzt nicht abrufbar')
      return summaryText(cache)
    }
  },
  onTripDelete: (tripId) => removeCache(tripId),
  onStart: () => startWatchUpload()
}
