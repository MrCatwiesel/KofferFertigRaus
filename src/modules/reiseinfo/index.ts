import type { AppModule } from '@/core/registry'
import { countryName } from '@/core/countries'
import { tripRepository } from '@/modules/trip/public'
import { countryInfoRepository } from './repository'
import { refreshIfStale, refreshTripInfos } from './refresh'
import { warningLabel } from './parse'
import { N_ } from '@/core/i18n'

/** Modul "Reisehinweise": Auswärtiges Amt – Sicherheitslage, Einreise, Impfschutz je Zielland. */
export const reiseinfoModule: AppModule = {
  id: 'reiseinfo',
  title: N_('Reisehinweise'),
  icon: 'shield-exclamation',
  order: 48,
  routes: [{ path: '/trip/:tripId/reisehinweise', name: 'reiseinfo', component: () => import('./views/ReiseinfoView.vue'), props: true }],
  tripSection: {
    phases: ['planung', 'unterwegs'],
    title: N_('Reisehinweise'),
    icon: 'shield-exclamation',
    to: (tripId) => `/trip/${tripId}/reisehinweise`,
    async summary(tripId) {
      void refreshIfStale(tripId).catch(() => undefined) // im Hintergrund aktuell halten
      const trip = await tripRepository.get(tripId)
      const countries = trip?.countries ?? []
      if (!countries.length) return 'Zielland angeben → Einreise, Impfschutz, Sicherheitslage'
      const infos = await countryInfoRepository.listByTrip(tripId)
      const parts = countries.map((c) => {
        const i = infos.find((x) => x.country === c)
        if (!i) return `${countryName(c)}: noch nicht abgerufen`
        return `${countryName(c)}: ${warningLabel(i).text}${i.unseenChange ? ' – geändert!' : ''}`
      })
      return parts.join(' · ')
    }
  },
  onTripSaved: async (tripId) => {
    await refreshTripInfos(tripId) // offline: nur Notfallnummern aus dem Gespeicherten, Abruf scheitert still
  },
  onTripDelete: (tripId) => countryInfoRepository.removeByTrip(tripId)
}
