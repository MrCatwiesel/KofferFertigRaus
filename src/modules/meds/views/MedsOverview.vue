<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLiveQuery } from '@/core/composables'
import { diffDays } from '@/core/dates'
import { formatDate } from '@/core/format'
import { TripContextHeader, participantsOf, tripRepository, type Trip } from '@/modules/trip/public'
import { countryInfoRepository, type CountryInfo } from '@/modules/reiseinfo/public'
import { medicationRepository, vaccinationRepository } from '../repository'
import {
  DEFAULT_RESERVE_DAYS, dailySchedule, emptyMedicationDraft, expiryStatus, matchVaccination, mergeVaccineAdvice, sortMeds, stockStatus,
  unitsNeeded, vaccinationFromAdvice, vaccinationNeedsAction, type VaccineAdvice
} from '../logic'
import { FIRST_AID_KIT, KIND, VACC_STATUS, type Medication, type Vaccination } from '../types'
import { t } from '@/i18n'

const props = defineProps<{ tripId: string }>()

const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const meds = useLiveQuery(() => medicationRepository.listByTrip(props.tripId), [] as Medication[])
const vaccs = useLiveQuery(() => vaccinationRepository.listByTrip(props.tripId), [] as Vaccination[])

const infos = useLiveQuery(() => countryInfoRepository.listByTrip(props.tripId), [] as CountryInfo[])

// Impfungen aus den Reisehinweisen der Zielländer – mit den eingetragenen abgleichen
const advice = computed(() =>
  mergeVaccineAdvice(infos.value.filter((i) => trip.value?.countries?.includes(i.country)))
    .map((a) => ({ ...a, match: matchVaccination(a, vaccs.value) }))
)
const adviceMissing = computed(() => advice.value.filter((a) => !a.match))
const requiredMissing = computed(() => adviceMissing.value.some((a) => a.required))

async function takeAdvice(list: VaccineAdvice[]) {
  if (list.length) await vaccinationRepository.createMany(props.tripId, list.map(vaccinationFromAdvice))
}

type Tab = 'medikamente' | 'plan' | 'impfungen'
const tab = ref<Tab>('medikamente')
const planPerson = ref('')

const days = computed(() => (trip.value ? diffDays(trip.value.startDate, trip.value.endDate) + 1 : 1))
const sorted = computed(() =>
  sortMeds(meds.value.filter((m) => !planPerson.value || !m.person || m.person === planPerson.value))
)
const schedule = computed(() => dailySchedule(meds.value, planPerson.value))
const people = computed(() => [...new Set([...participantsOf(trip.value), ...meds.value.map((m) => m.person).filter(Boolean)])])
const missingKit = computed(() => {
  const have = new Set(meds.value.map((m) => m.name.toLowerCase()))
  return FIRST_AID_KIT.filter((k) => !have.has(k.name.toLowerCase()))
})

const expiryLabel = {
  abgelaufen: { text: 'abgelaufen', cls: 'text-danger' },
  waehrend: { text: t('läuft während der Reise ab'), cls: 'text-warning-emphasis' }
} as const

function expiry(m: Medication) {
  if (!trip.value) return null
  const s = expiryStatus(m.expiryDate, trip.value.endDate)
  return s === 'abgelaufen' || s === 'waehrend' ? expiryLabel[s] : null
}

function togglePacked(m: Medication) {
  medicationRepository.setPacked(m.id, !m.packed)
}

async function addKit() {
  if (!missingKit.value.length) return
  await medicationRepository.createMany(
    props.tripId,
    missingKit.value.map((k) => emptyMedicationDraft({ name: k.name, kind: k.kind, times: [], unitsPerDose: null, handLuggage: false }))
  )
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="t('Reiseapotheke')" />

  <ul class="nav nav-pills mb-3">
    <li class="nav-item"><button class="nav-link" :class="{ active: tab === 'medikamente' }" @click="tab = 'medikamente'">{{ t('Medikamente') }}</button></li>
    <li class="nav-item"><button class="nav-link" :class="{ active: tab === 'plan' }" @click="tab = 'plan'">{{ t('Einnahmeplan') }}</button></li>
    <li class="nav-item">
      <button class="nav-link" :class="{ active: tab === 'impfungen' }" @click="tab = 'impfungen'">
        {{ t('Impfungen') }}
        <span v-if="requiredMissing || (trip && vaccs.some((v) => vaccinationNeedsAction(v, trip!.endDate)))" class="badge text-bg-warning ms-1">!</span>
      </button>
    </li>
  </ul>

  <!-- Person wählen (gilt für Medikamente und Einnahmeplan) -->
  <div v-if="people.length && tab !== 'impfungen'" class="d-flex flex-wrap gap-2 mb-3">
    <button type="button" class="btn btn-sm" :class="planPerson === '' ? 'btn-secondary' : 'btn-outline-secondary'" @click="planPerson = ''">{{ t('Alle') }}</button>
    <button v-for="p in people" :key="p" type="button" class="btn btn-sm"
            :class="planPerson === p ? 'btn-secondary' : 'btn-outline-secondary'" @click="planPerson = p">
      <i class="bi bi-person me-1" aria-hidden="true"></i>{{ p }}
    </button>
  </div>

  <!-- Medikamente -->
  <template v-if="tab === 'medikamente'">
    <div class="d-flex flex-wrap gap-2 mb-3">
      <RouterLink :to="`/trip/${tripId}/apotheke/medikament/neu`" class="btn btn-primary">
        <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>{{ t('Medikament') }}
      </RouterLink>
      <button v-if="missingKit.length" type="button" class="btn btn-outline-primary" @click="addKit">
        <i class="bi bi-bag-plus me-1" aria-hidden="true"></i>{{ t('Grundausstattung ({n})', { n: missingKit.length }) }}
      </button>
    </div>

    <p v-if="sorted.length === 0" class="text-body-secondary">
      {{ t('Trage Dauermedikamente mit Einnahmezeiten ein – die App rechnet aus, wie viel du für {days} Tage plus {DEFAULT_RESERVE_DAYS} Tage Reserve brauchst.', { days, DEFAULT_RESERVE_DAYS }) }}
    </p>

    <ul class="list-group mb-3">
      <li v-for="m in sorted" :key="m.id" class="list-group-item d-flex gap-2 align-items-start position-relative"
          :class="{ 'text-body-secondary': m.packed }">
        <input :id="`m-${m.id}`" class="form-check-input mt-1 flex-none position-relative z-2" type="checkbox"
               :checked="m.packed" :aria-label="`${m.name} eingepackt`" @change="togglePacked(m)" />
        <div class="flex-grow-1 min-w-0">
          <RouterLink :to="`/trip/${tripId}/apotheke/medikament/${m.id}`"
                      class="fw-semibold text-body text-decoration-none stretched-link"
                      :class="{ 'text-decoration-line-through': m.packed }">{{ m.name }}</RouterLink>
          <span v-if="m.person" class="badge text-bg-light border ms-1">{{ m.person }}</span>
          <div class="small text-body-secondary">
            <i :class="`bi bi-${KIND[m.kind].icon} me-1`" aria-hidden="true"></i>{{ KIND[m.kind].label }}
            <template v-if="m.kind === 'dauer' && m.times.length"> {{ t('· {x} um {join}', { x: m.dose || '', join: m.times.join(', ') }) }}</template>
          </div>
          <div v-if="unitsNeeded(m, days) !== null" class="small">
            {{ t('Bedarf: {unitsNeeded} Stück', { unitsNeeded: unitsNeeded(m, days) }) }}
            <template v-if="stockStatus(m, days).state === 'ok'">
              <span class="text-success"><i class="bi bi-check-circle ms-1" aria-hidden="true"></i> {{ t('reicht') }}</span>
            </template>
            <template v-else-if="stockStatus(m, days).state === 'knapp'">
              <span class="text-danger"><i class="bi bi-exclamation-circle ms-1" aria-hidden="true"></i> {{ t('{stockStatus} fehlen', { stockStatus: stockStatus(m, days).missing }) }}</span>
            </template>
            <span v-else class="text-body-secondary"> {{ t('· Vorrat nicht angegeben') }}</span>
          </div>
          <div v-if="expiry(m)" class="small" :class="expiry(m)!.cls">
            <i class="bi bi-calendar-x me-1" aria-hidden="true"></i>{{ expiry(m)!.text }} ({{ formatDate(m.expiryDate) }})
          </div>
          <div class="d-flex flex-wrap gap-1 mt-1">
            <span v-if="m.prescription" class="badge text-bg-info">{{ t('Rezept') }}</span>
            <span v-if="m.handLuggage" class="badge text-bg-light border">{{ t('Handgepäck') }}</span>
            <span v-if="m.cooling" class="badge text-bg-primary">{{ t('kühlen') }}</span>
          </div>
        </div>
      </li>
    </ul>
  </template>

  <!-- Einnahmeplan -->
  <template v-else-if="tab === 'plan'">
    <p v-if="schedule.length === 0" class="text-body-secondary">{{ t('Keine Dauermedikation mit Einnahmezeiten eingetragen.') }}</p>
    <ul v-else class="list-group mb-3">
      <li v-for="(e, idx) in schedule" :key="idx" class="list-group-item d-flex gap-3 align-items-center">
        <span class="fw-semibold font-monospace">{{ e.time }}</span>
        <span class="flex-grow-1">
          {{ e.medication.name }}<span v-if="e.medication.dose" class="text-body-secondary"> – {{ e.medication.dose }}</span>
        </span>
        <span v-if="e.medication.person" class="badge text-bg-light border">{{ e.medication.person }}</span>
      </li>
    </ul>
    <p class="small text-body-secondary">
      <i class="bi bi-globe me-1" aria-hidden="true"></i>
      {{ t('Bei Zeitverschiebung die Einnahmezeiten mit Arzt oder Apotheke abstimmen.') }}
    </p>
  </template>

  <!-- Impfungen -->
  <template v-else>
    <RouterLink :to="`/trip/${tripId}/apotheke/impfung/neu`" class="btn btn-primary mb-3">
      <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>{{ t('Impfung') }}
    </RouterLink>
    <div v-if="advice.length" class="card mb-3 advice">
      <div class="card-body py-2">
        <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
          <h2 class="h6 mb-0 flex-grow-1"><i class="bi bi-shield-exclamation me-1" aria-hidden="true"></i>{{ t('Laut Reisehinweisen') }}</h2>
          <button v-if="adviceMissing.length > 1" type="button" class="btn btn-sm btn-outline-primary" @click="takeAdvice(adviceMissing)">
            {{ t('Alle übernehmen ({n})', { n: adviceMissing.length }) }}
          </button>
        </div>
        <ul class="list-unstyled mb-1">
          <li v-for="a in advice" :key="a.name" class="d-flex flex-wrap align-items-center gap-2 py-1 border-top">
            <span class="fw-semibold">{{ a.name }}</span>
            <span v-if="a.required" class="badge text-bg-danger">{{ t('Pflicht') }}</span>
            <span class="small text-body-secondary flex-grow-1">{{ a.countries.join(', ') }}</span>
            <span v-if="a.match" class="badge" :class="VACC_STATUS[a.match.status].badge">{{ t('eingetragen: {x}', { x: VACC_STATUS[a.match.status].label }) }}</span>
            <button v-else type="button" class="btn btn-sm btn-outline-primary py-0" @click="takeAdvice([a])">
              <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>{{ t('Übernehmen') }}
            </button>
          </li>
        </ul>
        <p class="small text-body-secondary mb-0">
          {{ t('Vom Auswärtigen Amt genannt (Pflicht- und empfohlene Impfungen, auch Standardimpfungen). Was davon für euch nötig ist, klärt die reisemedizinische Beratung –') }} <RouterLink :to="`/trip/${tripId}/reisehinweise`">{{ t('Details in den Reisehinweisen') }}</RouterLink>.
        </p>
      </div>
    </div>

    <p v-if="vaccs.length === 0 && !advice.length" class="text-body-secondary">
      {{ t('Prüfe rechtzeitig (am besten 6–8 Wochen vorher) mit Hausarzt oder reisemedizinischer Beratung, welche Impfungen für dein Ziel empfohlen sind.') }}
    </p>
    <div class="vstack gap-2 mb-3">
      <div v-for="v in vaccs" :key="v.id" class="card position-relative">
        <div class="card-body py-2">
          <div class="d-flex justify-content-between gap-2">
            <RouterLink :to="`/trip/${tripId}/apotheke/impfung/${v.id}`" class="fw-semibold text-body text-decoration-none stretched-link">
              {{ v.name }}
            </RouterLink>
            <span class="badge" :class="VACC_STATUS[v.status].badge">{{ VACC_STATUS[v.status].label }}</span>
          </div>
          <div class="small text-body-secondary">
            <template v-if="v.person">{{ v.person }} · </template>
            <template v-if="v.date">{{ v.status === 'erledigt' ? 'geimpft' : t('Termin') }} {{ formatDate(v.date) }}</template>
            <template v-if="v.validUntil"> {{ t('· gültig bis {validUntil}', { validUntil: formatDate(v.validUntil) }) }}</template>
          </div>
          <div v-if="trip && v.status === 'erledigt' && vaccinationNeedsAction(v, trip.endDate)" class="small text-warning-emphasis">
            <i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>{{ t('Schutz endet vor Reiseende – Auffrischung prüfen') }}
          </div>
        </div>
      </div>
    </div>
  </template>

  <p class="small text-body-secondary border-top pt-2">
    {{ t('Die Reiseapotheke hilft beim Organisieren und ersetzt keine ärztliche oder pharmazeutische Beratung.') }}
  </p>
</template>

<style scoped>
.flex-none {
  flex: none;
}
.min-w-0 {
  min-width: 0;
}
</style>
