import type { AppModule } from '@/core/registry'
import { tripRepository } from '@/modules/trip/public'
import { medicationRepository, vaccinationRepository } from './repository'
import { summarizeMeds } from './logic'
import { medsReminders } from './reminders'
import { t, tn } from '@/i18n'

/** Modul "Reiseapotheke" (Meilenstein M2). */
export const medsModule: AppModule = {
  id: 'meds',
  title: t('Reiseapotheke'),
  icon: 'capsule',
  order: 45,
  routes: [
    { path: '/trip/:tripId/apotheke', name: 'meds-overview', component: () => import('./views/MedsOverview.vue'), props: true },
    { path: '/trip/:tripId/apotheke/medikament/neu', name: 'med-new', component: () => import('./views/MedicationEdit.vue'), props: true },
    { path: '/trip/:tripId/apotheke/medikament/:id', name: 'med-edit', component: () => import('./views/MedicationEdit.vue'), props: true },
    { path: '/trip/:tripId/apotheke/impfung/neu', name: 'vacc-new', component: () => import('./views/VaccinationEdit.vue'), props: true },
    { path: '/trip/:tripId/apotheke/impfung/:id', name: 'vacc-edit', component: () => import('./views/VaccinationEdit.vue'), props: true }
  ],
  reminders: async (trip, today) => medsReminders(await medicationRepository.listByTrip(trip.id), await vaccinationRepository.listByTrip(trip.id), trip, today),
  tripSection: {
    phases: ['planung', 'unterwegs'],
    title: t('Reiseapotheke'),
    icon: 'capsule',
    to: (tripId) => `/trip/${tripId}/apotheke`,
    async summary(tripId) {
      const [trip, meds, vaccs] = await Promise.all([
        tripRepository.get(tripId),
        medicationRepository.listByTrip(tripId),
        vaccinationRepository.listByTrip(tripId)
      ])
      if (!trip || (meds.length === 0 && vaccs.length === 0)) return t('Noch leer')
      const s = summarizeMeds(meds, vaccs, trip.startDate, trip.endDate)
      const parts = [tn(s.count, '1 Eintrag', '{n} Einträge')]
      if (s.short) parts.push(t('{n} reicht nicht', { n: s.short }))
      if (s.expiring) parts.push(t('{n} läuft ab', { n: s.expiring }))
      if (s.vaccinationsOpen) parts.push(t('{n} Impfung offen', { n: s.vaccinationsOpen }))
      if (parts.length === 1 && s.unpacked === 0 && s.count > 0) parts.push(t('alles eingepackt'))
      return parts.join(' · ')
    }
  },
  onTripDelete: async (tripId) => {
    await medicationRepository.removeByTrip(tripId)
    await vaccinationRepository.removeByTrip(tripId)
  }
}
