import type { AppModule } from '@/core/registry'
import { packingRepository } from './repository'
import { progress } from './logic'
import { packingReminders } from './reminders'
import { t } from '@/i18n'

/** Modul "Packliste" (Meilenstein M2). */
export const packingModule: AppModule = {
  id: 'packing',
  title: t('Packliste'),
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
    title: t('Packliste'),
    icon: 'backpack',
    to: (tripId) => `/trip/${tripId}/packliste`,
    async summary(tripId) {
      const p = progress(await packingRepository.listByTrip(tripId))
      if (p.total === 0) return t('Noch leer – mit Vorlage starten')
      const base = t('{packed} von {total} eingepackt', { packed: p.packed, total: p.total })
      return p.essentialOpen ? `${base} · ${t('{n} Wichtige fehlen', { n: p.essentialOpen })}` : base
    }
  },
  onTripDelete: (tripId) => packingRepository.removeByTrip(tripId),
  // Beispielreise: erst beim Anlegen nachladen (nicht im Startpaket)
  sampleData: (s) => import('./sample').then((m) => m.packingSample(s))
}
