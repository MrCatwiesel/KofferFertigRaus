import type { AppModule } from '@/core/registry'
import { statsLine } from './logic'
import { routeRepository } from './repository'

/** Modul "Routen & Touren": GPX/FIT/KML importieren, Karte, Höhenprofil, Export für Garmin. */
export const routesModule: AppModule = {
  id: 'routes',
  title: 'Routen & Touren',
  icon: 'signpost-2',
  order: 16,
  routes: [
    { path: '/trip/:tripId/routen', name: 'routes', component: () => import('./views/RoutesList.vue'), props: true },
    { path: '/trip/:tripId/routen/planen', name: 'route-planner', component: () => import('./views/RoutePlanner.vue'), props: true },
    { path: '/trip/:tripId/routen/:id', name: 'route', component: () => import('./views/RouteDetail.vue'), props: true }
  ],
  tripSection: {
    phases: ['planung', 'unterwegs', 'danach'],
    title: 'Routen & Touren',
    icon: 'signpost-2',
    to: (tripId) => `/trip/${tripId}/routen`,
    async summary(tripId) {
      const list = await routeRepository.listByTrip(tripId)
      if (!list.length) return 'GPX, Garmin (FIT), Google My Maps (KML)'
      const km = list.reduce((s, r) => s + r.stats.distance, 0) / 1000
      return `${list.length} ${list.length === 1 ? 'Route' : 'Routen'} · ${km.toLocaleString('de-DE', { maximumFractionDigits: 0 })} km`
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
  onTripDelete: (tripId) => routeRepository.removeByTrip(tripId)
}
