import type { AppModule } from '@/core/registry'
import { packingRepository } from './repository'
import { progress } from './logic'
import { packingReminders } from './reminders'
import { N_ } from '@/core/i18n'

/** Modul "Packliste" (Meilenstein M2). */
export const packingModule: AppModule = {
  id: 'packing',
  title: N_('Packliste'),
  icon: 'backpack',
  order: 40,
  routes: [
    { path: '/trip/:tripId/packliste', name: 'packing-list', component: () => import('./views/PackingList.vue'), props: true },
    { path: '/trip/:tripId/packliste/vorlagen', name: 'packing-templates', component: () => import('./views/PackingTemplates.vue'), props: true },
    { path: '/trip/:tripId/packliste/:id', name: 'packing-edit', component: () => import('./views/PackingEdit.vue'), props: true }
  ],
  reminders: async (trip, today) => packingReminders(await packingRepository.listByTrip(trip.id), trip, today),
  tripSection: {
    phases: ['planung'],
    title: N_('Packliste'),
    icon: 'backpack',
    to: (tripId) => `/trip/${tripId}/packliste`,
    async summary(tripId) {
      const p = progress(await packingRepository.listByTrip(tripId))
      if (p.total === 0) return 'Noch leer – mit Vorlage starten'
      const base = `${p.packed} von ${p.total} eingepackt`
      return p.essentialOpen ? `${base} · ${p.essentialOpen} Wichtige fehlen` : base
    }
  },
  onTripDelete: (tripId) => packingRepository.removeByTrip(tripId)
}
