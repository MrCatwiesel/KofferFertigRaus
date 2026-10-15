import { computed } from 'vue'
import { useLiveQuery } from '@/core/composables'
import { language, t } from '@/i18n'
import { LANGUAGE_OF_COUNTRY, languageName } from '@/modules/sprachfuehrer/public'
import { tripRepository, type Trip } from '@/modules/trip/public'
import { hasAllergies } from './logic'
import { healthRepository } from './repository'
import type { HealthProfile } from './types'

/** Verweis auf die Allergie-Karte (z. B. im Tagesplan bei Restaurants) – null, wenn niemand Allergien eingetragen hat */
export function useAllergyLink(tripId: string) {
  const trip = useLiveQuery(() => tripRepository.get(tripId), undefined as Trip | undefined)
  const profiles = useLiveQuery(() => healthRepository.listByTrip(tripId), [] as HealthProfile[])
  return computed(() => {
    if (!profiles.value.some(hasAllergies)) return null
    const countries = [...(trip.value?.countries ?? []), ...(trip.value?.transit ?? [])]
    const lang = countries.flatMap((c) => LANGUAGE_OF_COUNTRY[c] ?? []).find((l) => l !== language())
    return lang
      ? { to: `/trip/${tripId}/sprachfuehrer?sprache=${lang}`, label: t('Allergie-Karte ({language})', { language: languageName(lang) }) }
      : { to: `/trip/${tripId}/sos`, label: t('Allergie-Karte') }
  })
}
