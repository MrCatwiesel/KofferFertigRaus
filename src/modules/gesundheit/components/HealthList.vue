<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useLiveQuery } from '@/core/composables'
import { linkedMember, people, sharedLabel } from '@/core/people'
import { participantsOf, tripRepository, type Trip } from '@/modules/trip/public'
import { allergyNames, bloodTypeText, conditionNames, emptyDraft, hasContent, personLabel, personsOf } from '../logic'
import { healthRepository } from '../repository'
import type { HealthProfile } from '../types'
import DeviceAllergyTakeover from './DeviceAllergyTakeover.vue'
import { language } from '@/i18n'

/** Gesundheit aller Mitreisenden (Reiter „Gesundheit“ unter Dokumente & Notfall) */
const props = defineProps<{ tripId: string }>()
const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const profiles = useLiveQuery(() => healthRepository.listByTrip(props.tripId), [] as HealthProfile[])
const persons = computed(() => personsOf(participantsOf(trip.value), profiles.value))
const byPerson = computed(() => new Map(profiles.value.map((p) => [p.person, p])))
const editTo = (person: string) => ({ path: `/trip/${props.tripId}/gesundheit`, query: { person } })

// Angaben einer früheren Reise übernehmen (für Personen, die hier noch nichts haben)
const previous = ref<{ title: string; profiles: HealthProfile[] } | null>(null)
const missing = computed(() => persons.value.filter((p) => !hasContent(byPerson.value.get(p))))
watch(
  () => [trip.value?.id, missing.value.join('|')],
  async () => {
    previous.value = trip.value && missing.value.length ? await healthRepository.previousTrip(props.tripId, missing.value) : null
  },
  { immediate: true }
)
async function takeOver() {
  if (!previous.value) return
  for (const p of previous.value.profiles) {
    if (!missing.value.includes(p.person)) continue
    await healthRepository.merge(props.tripId, p.person, p, { ...emptyDraft(), sharedWith: p.sharedWith ?? ['*'] })
  }
}
</script>

<template>
  <div data-health-list>
    <div class="d-flex flex-wrap gap-2 mb-3">
      <RouterLink :to="`/trip/${tripId}/sos`" class="btn btn-danger" data-sos-link>
        <i class="bi bi-heart-pulse me-1" aria-hidden="true"></i>{{ t('Notfall-Seite & Notfallkarte') }}
      </RouterLink>
    </div>

    <DeviceAllergyTakeover :trip-id="tripId" :persons="persons" />

    <div v-if="previous" class="alert alert-info d-flex flex-wrap align-items-center gap-2 py-2" data-health-previous>
      <span class="flex-grow-1 small">
        {{ t('Angaben aus „{title}“ übernehmen: {names}', { title: previous.title, names: previous.profiles.filter((p) => missing.includes(p.person)).map((p) => personLabel(p.person)).join(', ') }) }}
      </span>
      <button type="button" class="btn btn-sm btn-primary" @click="takeOver">{{ t('Übernehmen') }}</button>
    </div>

    <ul class="list-group mb-3">
      <li v-for="person in persons" :key="person" class="list-group-item" :data-health-person="person">
        <div class="d-flex align-items-start gap-2">
          <div class="flex-grow-1 min-w-0">
            <div class="fw-semibold">
              <i class="bi bi-person me-1 text-primary" aria-hidden="true"></i>{{ personLabel(person) }}
              <span v-if="person && !trip?.participants.includes(person)" class="badge text-bg-light border fw-normal ms-1">{{ t('nicht mehr in der Reise') }}</span>
            </div>
            <template v-if="hasContent(byPerson.get(person))">
              <div v-if="allergyNames(byPerson.get(person)!).length" class="d-flex flex-wrap gap-1 mt-1">
                <span v-for="a in allergyNames(byPerson.get(person)!)" :key="a" class="badge text-bg-danger fw-normal">{{ a }}</span>
              </div>
              <div v-if="conditionNames(byPerson.get(person)!).length" class="small mt-1">
                <i class="bi bi-clipboard2-pulse me-1" aria-hidden="true"></i>{{ conditionNames(byPerson.get(person)!).join(', ') }}
              </div>
              <div v-if="byPerson.get(person)!.bloodType" class="small">{{ t('Blutgruppe') }} {{ bloodTypeText(byPerson.get(person)!.bloodType, language()) }}</div>
              <div v-if="byPerson.get(person)!.notes" class="small text-body-secondary">{{ byPerson.get(person)!.notes }}</div>
              <div v-if="linkedMember(people, trip?.memberLinks, person)" class="small text-body-secondary mt-1">
                <i class="bi bi-person-lock me-1" aria-hidden="true"></i>{{ sharedLabel(people, byPerson.get(person)!.sharedWith) }}
              </div>
            </template>
            <div v-else class="small text-body-secondary">{{ t('Noch nichts eingetragen') }}</div>
          </div>
          <RouterLink :to="editTo(person)" class="btn btn-sm btn-outline-primary flex-none" :data-health-edit="person">
            {{ hasContent(byPerson.get(person)) ? t('Ändern') : t('Eintragen') }}
          </RouterLink>
        </div>
      </li>
    </ul>
    <p class="small text-body-secondary">
      <i class="bi bi-info-circle me-1" aria-hidden="true"></i>{{ t('Allergien und Erkrankungen erscheinen auf der Notfall-Seite und im Sprachführer – in der Landessprache. Mit einem Konto verknüpfte Personen legen selbst fest, wer ihre Angaben sieht (Standard: alle Mitreisenden).') }}
    </p>
  </div>
</template>

<style scoped>
.min-w-0 {
  min-width: 0;
}
.flex-none {
  flex: none;
}
</style>
