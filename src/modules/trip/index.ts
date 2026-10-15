import type { AppModule } from '@/core/registry'
import { tripSample } from './sample'

/** Modul "Reiseprojekt" (Meilenstein M1). */
export const tripModule: AppModule = {
  id: 'trip',
  title: 'Reisen',
  icon: 'suitcase-lg',
  navTo: '/trip',
  order: 10,
  routes: [
    { path: '/trip', name: 'trip-list', component: () => import('./views/TripList.vue') },
    { path: '/trip/neu', name: 'trip-new', component: () => import('./views/TripEdit.vue') },
    { path: '/trip/:id', name: 'trip-detail', component: () => import('./views/TripDetail.vue'), props: true },
    { path: '/trip/:id/bearbeiten', name: 'trip-edit', component: () => import('./views/TripEdit.vue'), props: true },
    { path: '/trip/:id/titelbild', name: 'trip-cover', component: () => import('./views/TripCoverEdit.vue'), props: true }
  ],
  sampleData: tripSample
}
