import type { AppModule } from '@/core/registry'
import { todayIso } from '@/core/dates'
import { tripRepository } from '@/modules/trip/public'
import { syncState } from '@/core/sync/engine'
import { aktuelle, betrifftReise, imZeitfenster, VORLAUF_TAGE, zusammenfassung } from './logic'
import { unwetterRepository } from './repository'
import { refreshIfStale } from './refresh'
import { startBeobachtung } from './beobachten'
import { N_, t } from '@/core/i18n'

/** Modul „Unwetter“: amtliche Warnungen (MeteoAlarm) für die Orte der Reise – auch als Push-Benachrichtigung. */
export const unwetterModule: AppModule = {
  id: 'unwetter',
  title: N_('Unwetterwarnungen'),
  icon: 'cloud-lightning-rain',
  order: 49,
  routes: [{ path: '/trip/:tripId/unwetter', name: 'unwetter', component: () => import('./views/UnwetterView.vue'), props: true }],
  tripSection: {
    phases: ['planung', 'unterwegs'],
    title: N_('Unwetterwarnungen'),
    icon: 'cloud-lightning-rain',
    to: (tripId) => `/trip/${tripId}/unwetter`,
    async summary(tripId) {
      const trip = await tripRepository.get(tripId)
      if (!trip) return ''
      if (!syncState.configured) return t('Über den eigenen Server (Geräte-Abgleich)')
      if (!imZeitfenster(trip, todayIso())) return trip.endDate < todayIso() ? t('Reise vorbei') : t('Ab {0} Tage vor der Reise (MeteoAlarm)', [VORLAUF_TAGE])
      void refreshIfStale(tripId).catch(() => undefined) // im Hintergrund aktuell halten
      const s = await unwetterRepository.get(tripId)
      if (!s) return t('Noch nicht abgerufen')
      return zusammenfassung(aktuelle(s).filter((w) => betrifftReise(w, s)))
    }
  },
  onTripDelete: (tripId) => unwetterRepository.remove(tripId),
  onStart: () => startBeobachtung()
}
