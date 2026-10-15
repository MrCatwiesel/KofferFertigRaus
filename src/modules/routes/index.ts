import type { AppModule } from '@/core/registry'
import { routeDayFacts } from './day-facts'
import { statsLine } from './logic'
import { routeRepository } from './repository'
import { t, tn, intlLocale } from '@/i18n'

/** Modul "Routen & Touren": GPX/FIT/KML importieren, Karte, Höhenprofil, Export für Garmin. */
export const routesModule: AppModule = {
  id: 'routes',
  title: t('Routen & Touren'),
  icon: 'signpost-2',
  order: 16,
  routes: [
    { path: '/trip/:tripId/routen', name: 'routes', component: () => import('./views/RoutesList.vue'), props: true },
    { path: '/trip/:tripId/routen/planen', name: 'route-planner', component: () => import('./views/RoutePlanner.vue'), props: true },
    { path: '/trip/:tripId/routen/:id', name: 'route', component: () => import('./views/RouteDetail.vue'), props: true }
  ],
  tripSection: {
    phases: ['planung', 'unterwegs', 'danach'],
    title: t('Routen & Touren'),
    icon: 'signpost-2',
    to: (tripId) => `/trip/${tripId}/routen`,
    async summary(tripId) {
      const list = await routeRepository.listByTrip(tripId)
      if (!list.length) return t('GPX, Garmin (FIT), Google My Maps (KML)')
      const km = list.reduce((s, r) => s + r.stats.distance, 0) / 1000
      return `${tn(list.length, '1 Route', '{n} Routen')} · ${km.toLocaleString(intlLocale(), { maximumFractionDigits: 0 })} km`
    }
  },
  async mapOverlays(tripId) {
    return (await routeRepository.listByTrip(tripId)).map((r) => ({
      id: r.id,
      name: r.name,
      color: r.color,
      points: r.points.map((p) => [p[0], p[1]] as [number, number]),
      date: r.date,
      to: `/trip/${tripId}/routen/${r.id}`,
      info: statsLine(r.stats)
    }))
  },
  async dayLinks(tripId) {
    return (await routeRepository.listByTrip(tripId))
      .filter((r) => r.date)
      .map((r) => ({
        date: r.date,
        label: `${r.name} · ${statsLine({ ...r.stats, duration: null, descent: 0 })}`,
        icon: r.kind === 'track' ? 'person-walking' : 'signpost-2',
        to: `/trip/${tripId}/routen/${r.id}`,
        color: r.color
      }))
  },
  // Namen mit falscher Zeichenkodierung aus älteren Versionen reparieren („Gro�glockner“)
  // und fehlende Höhen ergänzen (Dateien ohne Höhenangaben, z. B. aus manchen Apps exportiert)
  onStart: () => {
    setTimeout(() => void routeRepository.maintain(navigator.onLine).catch(() => 0), 8000) // nach dem ersten Abgleich, damit auch Routen der anderen Geräte dabei sind
  },
  dayFacts: async (tripId, date) => routeDayFacts(await routeRepository.listByTrip(tripId), date),
  onTripDelete: (tripId) => routeRepository.removeByTrip(tripId)
}
