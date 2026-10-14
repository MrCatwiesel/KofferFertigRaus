import type { AppModule } from '@/core/registry'
import { tripRepository } from '@/modules/trip/public'
import { contactRepository, documentRepository } from './repository'
import { summarizeDocs } from './logic'
import { documentReminders } from './reminders'
import { N_ } from '@/core/i18n'

/** Modul "Dokumente & Notfall" (Meilenstein M2). */
export const documentsModule: AppModule = {
  id: 'documents',
  title: N_('Dokumente'),
  icon: 'folder2-open',
  order: 50,
  routes: [
    { path: '/trip/:tripId/dokumente', name: 'docs-overview', component: () => import('./views/DocumentsOverview.vue'), props: true },
    { path: '/trip/:tripId/dokumente/neu', name: 'doc-new', component: () => import('./views/DocumentEdit.vue'), props: true },
    { path: '/trip/:tripId/dokumente/:id', name: 'doc-edit', component: () => import('./views/DocumentEdit.vue'), props: true },
    { path: '/trip/:tripId/notfall/neu', name: 'contact-new', component: () => import('./views/ContactEdit.vue'), props: true },
    { path: '/trip/:tripId/notfall/:id', name: 'contact-edit', component: () => import('./views/ContactEdit.vue'), props: true }
  ],
  reminders: async (trip, today) => documentReminders(await documentRepository.listByTrip(trip.id), trip, today),
  tripSection: {
    phases: ['planung', 'unterwegs'],
    title: N_('Dokumente & Notfall'),
    icon: 'folder2-open',
    to: (tripId) => `/trip/${tripId}/dokumente`,
    async summary(tripId) {
      const [trip, docs] = await Promise.all([tripRepository.get(tripId), documentRepository.listByTrip(tripId)])
      if (!trip || docs.length === 0) return 'Noch leer – mit Vorschlägen starten'
      const s = summarizeDocs(docs, trip.endDate)
      const parts = [`${s.total} Dokumente`]
      if (s.missing) parts.push(`${s.missing} fehlen`)
      if (s.problems) parts.push(`${s.problems} Gültigkeit prüfen`)
      if (!s.missing && !s.problems) parts.push('alles in Ordnung')
      return parts.join(' · ')
    }
  },
  onTripDelete: async (tripId) => {
    await documentRepository.removeByTrip(tripId)
    await contactRepository.removeByTrip(tripId)
  }
}
