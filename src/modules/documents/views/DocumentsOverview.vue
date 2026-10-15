<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useLiveQuery } from '@/core/composables'
import { formatDate } from '@/core/format'
import { TripContextHeader, participantsOf, tripRepository, type Trip } from '@/modules/trip/public'
import { contactRepository, documentRepository } from '../repository'
import { VALIDITY_TEXT, maskNumber, needsRenewalSoon, sortDocs, suggestDocuments, summarizeDocs, telHref, validity } from '../logic'
import { DOC_STATUS, DOC_TYPE, STANDARD_NUMBERS, type EmergencyContact, type TravelDocument } from '../types'

const props = defineProps<{ tripId: string }>()

const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const docs = useLiveQuery(() => documentRepository.listByTrip(props.tripId), [] as TravelDocument[])
const contactsRaw = useLiveQuery(() => contactRepository.listByTrip(props.tripId), [] as EmergencyContact[])
// Eigene Nummern zuerst, danach die automatisch eingetragenen (Botschaft …)
const contacts = computed(() =>
  [...contactsRaw.value].sort((a, b) => Number(!!a.source) - Number(!!b.source) || (a.source && b.source ? a.label.localeCompare(b.label, 'de') : 0))
)

const tab = ref<'dokumente' | 'notfall'>(useRoute().query.tab === 'notfall' ? 'notfall' : 'dokumente')
const showNumbers = ref(false)

const sorted = computed(() => (trip.value ? sortDocs(docs.value, trip.value.endDate) : docs.value))
const summary = computed(() => (trip.value ? summarizeDocs(docs.value, trip.value.endDate) : null))
const suggestions = computed(() => (trip.value ? suggestDocuments(trip.value.transport, docs.value, participantsOf(trip.value)) : []))
const renewals = computed(() =>
  trip.value ? docs.value.filter((d) => needsRenewalSoon(d, trip.value!.startDate, trip.value!.endDate)) : []
)

function validityInfo(d: TravelDocument) {
  if (!trip.value) return null
  const v = validity(d, trip.value.endDate)
  return v === 'ok' || v === 'unbekannt' ? null : VALIDITY_TEXT[v]
}

function togglePacked(d: TravelDocument) {
  documentRepository.setPacked(d.id, !d.packed)
}

async function addSuggestions() {
  await documentRepository.createMany(props.tripId, suggestions.value)
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="t('Dokumente & Notfall')" />

  <ul class="nav nav-pills mb-3">
    <li class="nav-item"><button class="nav-link" :class="{ active: tab === 'dokumente' }" @click="tab = 'dokumente'">{{ t('Dokumente') }}</button></li>
    <li class="nav-item"><button class="nav-link" :class="{ active: tab === 'notfall' }" @click="tab = 'notfall'">{{ t('Notfallnummern') }}</button></li>
  </ul>

  <!-- Dokumente -->
  <template v-if="tab === 'dokumente'">
    <div v-for="d in renewals" :key="`r-${d.id}`" class="alert alert-danger py-2 small">
      <i class="bi bi-hourglass-split me-1" aria-hidden="true"></i>
      <strong>{{ d.title }}<template v-if="d.person"> ({{ d.person }})</template>:</strong>
      {{ t('jetzt kümmern – die Ausstellung kann mehrere Wochen dauern.') }}
    </div>

    <div v-if="summary && summary.total" class="d-flex flex-wrap gap-2 small mb-3">
      <span class="badge text-bg-light border">{{ t('{total} Dokumente', { total: summary.total }) }}</span>
      <span v-if="summary.missing" class="badge text-bg-danger">{{ t('{missing} fehlen / beantragt', { missing: summary.missing }) }}</span>
      <span v-if="summary.problems" class="badge text-bg-warning">{{ t('{problems} Gültigkeit prüfen', { problems: summary.problems }) }}</span>
      <span v-if="summary.notPacked" class="badge text-bg-light border">{{ t('{notPacked} noch nicht eingepackt', { notPacked: summary.notPacked }) }}</span>
    </div>

    <div class="d-flex flex-wrap gap-2 mb-3">
      <RouterLink :to="`/trip/${tripId}/dokumente/neu`" class="btn btn-primary">
        <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>{{ t('Dokument') }}
      </RouterLink>
      <button v-if="suggestions.length" type="button" class="btn btn-outline-primary" @click="addSuggestions">
        <i class="bi bi-magic me-1" aria-hidden="true"></i>{{ t('Vorschläge ({n})', { n: suggestions.length }) }}
      </button>
      <div v-if="docs.some((d) => d.number)" class="form-check form-switch ms-auto align-self-center mb-0">
        <input id="show-num" v-model="showNumbers" class="form-check-input" type="checkbox" role="switch" />
        <label class="form-check-label small" for="show-num">{{ t('Nummern zeigen') }}</label>
      </div>
    </div>

    <p v-if="sorted.length === 0" class="text-body-secondary">
      {{ t('Mit „Vorschläge“ legst du die üblichen Dokumente passend zur Anreise an. Trage Ablaufdaten ein – die App warnt rechtzeitig.') }}
    </p>

    <ul class="list-group mb-3">
      <li v-for="d in sorted" :key="d.id" class="list-group-item d-flex gap-2 align-items-start position-relative"
          :class="{ 'text-body-secondary': d.packed }">
        <input class="form-check-input mt-1 flex-none position-relative z-2" type="checkbox" :checked="d.packed"
               :disabled="d.status !== 'vorhanden'" :aria-label="t('{name} eingepackt', { name: d.title })" @change="togglePacked(d)" />
        <div class="flex-grow-1 min-w-0">
          <div class="d-flex justify-content-between gap-2">
            <RouterLink :to="`/trip/${tripId}/dokumente/${d.id}`" class="fw-semibold text-body text-decoration-none stretched-link"
                        :class="{ 'text-decoration-line-through': d.packed }">
              <i :class="`bi bi-${DOC_TYPE[d.type].icon} me-1 text-primary`" aria-hidden="true"></i>{{ d.title }}
            </RouterLink>
            <span v-if="d.status !== 'vorhanden'" class="badge flex-none" :class="DOC_STATUS[d.status].badge">{{ DOC_STATUS[d.status].label }}</span>
          </div>
          <div class="small text-body-secondary">
            <template v-if="d.person">{{ d.person }} · </template>
            <template v-if="d.number">{{ t('Nr. {x} ·', { x: showNumbers ? d.number : maskNumber(d.number) }) }} </template>
            <template v-if="d.validUntil">{{ t('gültig bis {validUntil}', { validUntil: formatDate(d.validUntil) }) }}</template>
          </div>
          <div v-if="validityInfo(d)" class="small" :class="validityInfo(d)!.cls">
            <i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>{{ validityInfo(d)!.text }}
          </div>
          <div v-if="d.hasCopy" class="small text-success"><i class="bi bi-cloud-check me-1" aria-hidden="true"></i>{{ t('Kopie vorhanden') }}</div>
        </div>
      </li>
    </ul>

    <p class="small text-body-secondary">
      <i class="bi bi-lock me-1" aria-hidden="true"></i>{{ t('Alle Angaben bleiben nur auf diesem Gerät. Tipp: Kopien wichtiger Dokumente zusätzlich sicher ablegen, z. B. als Foto in einem gesperrten Album.') }}
    </p>
  </template>

  <!-- Notfall -->
  <template v-else>
    <div class="list-group mb-3">
      <a v-for="n in STANDARD_NUMBERS" :key="n.phone" :href="telHref(n.phone) ?? undefined"
         class="list-group-item list-group-item-action d-flex align-items-center gap-3">
        <i class="bi bi-telephone-fill text-danger fs-5" aria-hidden="true"></i>
        <div class="flex-grow-1">
          <div class="fw-semibold">{{ n.label }}: {{ n.phone }}</div>
          <div class="small text-body-secondary">{{ n.note }}</div>
        </div>
      </a>
    </div>

    <h2 class="h6 text-body-secondary">{{ t('Eigene Nummern') }}</h2>
    <p v-if="contacts.length === 0" class="small text-body-secondary">
      {{ t('z. B. Notruf der Auslandskrankenversicherung, Unterkunft, Pannendienst, Botschaft, Hausarzt.') }}
    </p>
    <div class="list-group mb-3">
      <div v-for="c in contacts" :key="c.id" class="list-group-item d-flex align-items-center gap-3">
        <div class="flex-grow-1 min-w-0">
          <RouterLink :to="`/trip/${tripId}/notfall/${c.id}`" class="fw-semibold text-body text-decoration-none">{{ c.label }}</RouterLink>
          <span v-if="c.source" class="badge text-bg-light border ms-1 fw-normal" :title="t('Automatisch aus den Reisehinweisen des Auswärtigen Amts')">{{ t('Auswärtiges Amt') }}</span>
          <div class="small text-body-secondary text-truncate">{{ c.phone }}<template v-if="c.notes"> · {{ c.notes }}</template></div>
        </div>
        <a v-if="telHref(c.phone)" :href="telHref(c.phone)!" class="btn btn-success btn-sm" :aria-label="t('{name} anrufen', { name: c.label })">
          <i class="bi bi-telephone" aria-hidden="true"></i>
        </a>
      </div>
    </div>
    <RouterLink :to="`/trip/${tripId}/notfall/neu`" class="btn btn-primary">
      <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>{{ t('Nummer hinzufügen') }}
    </RouterLink>
  </template>
</template>

<style scoped>
.flex-none {
  flex: none;
}
.min-w-0 {
  min-width: 0;
}
</style>
