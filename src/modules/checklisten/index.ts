import type { AppModule } from '@/core/registry'
import { accommodationRepository } from '@/modules/accommodation/public'
import { travelRepository } from '@/modules/travel/public'
import { checklistRepository } from './repository'
import { checklistReminders, checklistSummary } from './logic'
import { t } from '@/i18n'

async function load(tripId: string) {
  return Promise.all([checklistRepository.listByTrip(tripId), accommodationRepository.listByTrip(tripId), travelRepository.listByTrip(tripId)])
}

/** Modul „Abreise-Checklisten“: zu Hause vor der Abfahrt, Online-Check-in vor Flügen, Auschecken aus jeder Unterkunft. */
export const checklistenModule: AppModule = {
  id: 'checklisten',
  title: t('Abreise-Checklisten'),
  icon: 'clipboard-check',
  order: 41,
  routes: [{ path: '/trip/:tripId/checklisten', name: 'checklists', component: () => import('./views/ChecklistsView.vue'), props: true }],
  tripSection: {
    phases: ['planung', 'unterwegs'],
    title: t('Abreise-Checklisten'),
    icon: 'clipboard-check',
    to: (tripId) => `/trip/${tripId}/checklisten`,
    async summary(tripId) {
      const [items, stays, legs] = await load(tripId)
      return checklistSummary(items, stays, legs, tripId)
    }
  },
  reminders: async (trip, today) => {
    const [items, stays, legs] = await load(trip.id)
    return checklistReminders(trip, today, items, stays, legs)
  },
  onTripDelete: (tripId) => checklistRepository.removeByTrip(tripId),
  // Beispielreise: erst beim Anlegen nachladen (nicht im Startpaket)
  sampleData: (s) => import('./sample').then((m) => m.checklistSample(s))
}
