<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { diffDays } from '@/core/dates'
import { formatDate } from '@/core/format'
import { TripContextHeader, participantsOf, tripRepository, type Trip } from '@/modules/trip/public'
import { packingRepository } from '../repository'
import { draftsFromOtherTrip, draftsFromTemplates } from '../logic'
import { TEMPLATES } from '../templates'
import { CATEGORY, type PackingItem } from '../types'

const props = defineProps<{ tripId: string }>()
const router = useRouter()

const trip = ref<Trip>()
const existing = ref<PackingItem[]>([])
const otherTrips = ref<Trip[]>([])
const selected = ref(new Set<string>(['basis']))
const sourceTrip = ref('')
const sourceItems = ref<PackingItem[]>([])
const busy = ref(false)
/** Für wen persönliche Dinge angelegt werden (Standard: alle Teilnehmer) */
const forPeople = ref(new Set<string>())
const participants = computed(() => participantsOf(trip.value))

/** Reisedauer in Tagen (inkl. An- und Abreisetag) */
const days = computed(() => {
  if (!trip.value) return 1
  return diffDays(trip.value.startDate, trip.value.endDate) + 1
})

onMounted(async () => {
  trip.value = await tripRepository.get(props.tripId)
  if (!trip.value) return router.replace('/trip')
  existing.value = await packingRepository.listByTrip(props.tripId)
  forPeople.value = new Set(participantsOf(trip.value))
  // Passende Vorlage zur Anreiseart vorschlagen
  if (trip.value.transport === 'auto') selected.value.add('auto')
  if (trip.value.transport === 'flug') selected.value.add('flug')
  otherTrips.value = (await tripRepository.listAll()).filter((t) => t.id !== props.tripId)
})

function togglePerson(p: string) {
  const s = new Set(forPeople.value)
  if (s.has(p)) s.delete(p)
  else s.add(p)
  forPeople.value = s
}

function toggle(id: string) {
  const s = new Set(selected.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  selected.value = s
}

const preview = computed(() =>
  draftsFromTemplates(
    TEMPLATES.filter((t) => selected.value.has(t.id)),
    days.value,
    trip.value?.travelers ?? 1,
    existing.value,
    participants.value.filter((p) => forPeople.value.has(p))
  )
)
/** Vorschau je Person: "Ich 34 · Anna 34 · Gemeinsam 20" */
const previewByPerson = computed(() => {
  const m = new Map<string, number>()
  for (const d of preview.value) m.set(d.person || 'Gemeinsam', (m.get(d.person || 'Gemeinsam') ?? 0) + 1)
  return [...m.entries()]
})
const previewByCategory = computed(() => {
  const m = new Map<string, number>()
  for (const d of preview.value) m.set(CATEGORY[d.category].label, (m.get(CATEGORY[d.category].label) ?? 0) + 1)
  return [...m.entries()]
})

async function addTemplates() {
  if (!preview.value.length) return
  busy.value = true
  await packingRepository.createMany(props.tripId, preview.value)
  router.push(`/trip/${props.tripId}/packliste`)
}

async function loadSource() {
  sourceItems.value = sourceTrip.value ? await packingRepository.listByTrip(sourceTrip.value) : []
}
const fromOther = computed(() => draftsFromOtherTrip(sourceItems.value, existing.value, participants.value))

async function addFromOther() {
  if (!fromOther.value.length) return
  busy.value = true
  await packingRepository.createMany(props.tripId, fromOther.value)
  router.push(`/trip/${props.tripId}/packliste`)
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="t('Packliste füllen')" />

  <section class="mb-4">
    <h2 class="h5">{{ t('Vorlagen') }}</h2>
    <p class="small text-body-secondary">
      {{ t('Mengen für {days} {x} und {x2} {x3}. Doppeltes wird zusammengefasst, Vorhandenes übersprungen.', { days, x: days === 1 ? 'Tag' : 'Tage', x2: trip?.travelers ?? 1, x3: (trip?.travelers ?? 1) === 1 ? 'Person' : 'Personen' }) }}
    </p>
    <div v-if="participants.length" class="mb-3">
      <div class="small fw-semibold mb-1">{{ t('Persönliches anlegen für:') }}</div>
      <div class="d-flex flex-wrap gap-2">
        <template v-for="p in participants" :key="p">
          <input :id="`fp-${p}`" type="checkbox" class="btn-check" :checked="forPeople.has(p)" @change="togglePerson(p)" />
          <label class="btn btn-sm btn-outline-secondary" :for="`fp-${p}`"><i class="bi bi-person me-1" aria-hidden="true"></i>{{ p }}</label>
        </template>
      </div>
      <div class="form-text">{{ t('Kleidung, Zahnbürste, Ladekabel usw. bekommt jede gewählte Person einzeln, Gemeinsames kommt einmal auf die Liste.') }}</div>
    </div>
    <div v-else class="alert alert-light border small py-2">
      <i class="bi bi-lightbulb me-1" aria-hidden="true"></i>{{ t('Tipp: Trag bei der Reise unter „Wer reist mit?“ Namen ein – dann wird Persönliches pro Person getrennt.') }}
    </div>

    <div class="row g-2 mb-3">
      <div v-for="tpl in TEMPLATES" :key="tpl.id" class="col-6 col-md-4">
        <input :id="`tpl-${tpl.id}`" type="checkbox" class="btn-check" :checked="selected.has(tpl.id)" @change="toggle(tpl.id)" />
        <label class="btn btn-outline-primary w-100 h-100 text-start p-2" :for="`tpl-${tpl.id}`">
          <i :class="`bi bi-${tpl.icon} me-1`" aria-hidden="true"></i><span class="fw-semibold">{{ tpl.title }}</span>
          <span class="d-block small opacity-75">{{ tpl.description }}</span>
        </label>
      </div>
    </div>

    <div v-if="preview.length" class="small text-body-secondary mb-2">
      {{ t('{n} neue Einträge:', { n: preview.length }) }}
      <span v-for="([label, n], idx) in previewByCategory" :key="label">{{ idx ? ', ' : '' }}{{ n }} {{ label }}</span>
      <div v-if="participants.length">
        <span v-for="([who, n], idx) in previewByPerson" :key="who">{{ idx ? ' · ' : '' }}{{ who }}: {{ n }}</span>
      </div>
    </div>
    <div v-else class="small text-body-secondary mb-2">{{ t('Keine neuen Einträge – alles schon auf der Liste.') }}</div>
    <button type="button" class="btn btn-primary" :disabled="busy || !preview.length" @click="addTemplates">
      <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>{{ t('{n} Einträge hinzufügen', { n: preview.length }) }}
    </button>
  </section>

  <section v-if="otherTrips.length" class="mb-4">
    <h2 class="h5">{{ t('Von einer anderen Reise übernehmen') }}</h2>
    <div class="input-group">
      <select v-model="sourceTrip" class="form-select" :aria-label="t('Reise auswählen')" @change="loadSource">
        <option value="">{{ t('Reise auswählen …') }}</option>
        <option v-for="tpl in otherTrips" :key="tpl.id" :value="tpl.id">{{ tpl.title }} ({{ formatDate(tpl.startDate) }})</option>
      </select>
      <button type="button" class="btn btn-outline-primary" :disabled="busy || !fromOther.length" @click="addFromOther">
        {{ sourceTrip ? `${fromOther.length} übernehmen` : 'Übernehmen' }}
      </button>
    </div>
    <div v-if="sourceTrip && sourceItems.length === 0" class="form-text">{{ t('Diese Reise hat keine Packliste.') }}</div>
  </section>

  <RouterLink :to="`/trip/${tripId}/packliste`" class="btn btn-outline-secondary">{{ t('Zurück zur Packliste') }}</RouterLink>
</template>
