<script setup lang="ts">
/**
 * Buchung einlesen: Text einfügen oder Datei wählen (PDF, E-Mail, Kalender) → Vorschlag prüfen → übernehmen.
 * Alles läuft auf dem Gerät – nichts wird hochgeladen.
 */
import { computed, reactive, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { useLiveQuery } from '@/core/composables'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import { ACCOMMODATION_TYPE_LABELS, accommodationRepository } from '@/modules/accommodation/public'
import { travelRepository } from '@/modules/travel/public'
import { documentRepository, emptyDocumentDraft } from '@/modules/documents/public'
import { parseBooking, type BookingGuess, type LegGuess } from '../parse'
import { fileToText } from '../extract'
import { MODE_LABEL, excerpt, legDrafts, outsideTrip, stayDraft } from '../logic'

const props = defineProps<{ tripId: string }>()
const router = useRouter()
const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)

const text = ref('')
const source = ref('')
const busy = ref(false)
const error = ref('')
const guess = shallowRef<BookingGuess | null>(null)
const kind = ref<'unterkunft' | 'reise' | 'dokument'>('unterkunft')
const stay = reactive({ name: '', type: 'hotel', address: '', checkIn: '', checkOut: '', price: null as number | null, currency: 'EUR', bookingRef: '', cancelUntil: '', url: '' })
const legs = ref<(LegGuess & { direction: 'hin' | 'rueck' })[]>([])
const docTitle = ref('')
const existing = ref<{ id: string; name: string } | null>(null)

const TYPES = ACCOMMODATION_TYPE_LABELS
const MODES = MODE_LABEL

async function analyse() {
  error.value = ''
  if (!text.value.trim()) {
    guess.value = null
    return
  }
  const g = parseBooking(text.value, trip.value?.startDate ?? '')
  guess.value = g
  kind.value = g.kind === 'unbekannt' ? 'dokument' : g.kind
  Object.assign(stay, g.stay)
  const t = trip.value
  const ld = legDrafts(g, { startDate: t?.startDate ?? '', endDate: t?.endDate ?? '', currency: t?.currency ?? 'EUR' }, '')
  legs.value = g.legs.map((l, i) => ({ ...l, direction: ld[i].direction }))
  docTitle.value = g.stay.name || (g.legs[0] ? `${MODES[g.legs[0].mode]} ${g.legs[0].from} – ${g.legs[0].to}` : 'Buchung')
  // Schon eingetragen? (gleiche Buchungsnummer)
  existing.value = null
  if (g.bookingRef && g.kind === 'unterkunft') {
    const same = (await accommodationRepository.listByTrip(props.tripId)).find((a) => a.bookingRef && a.bookingRef === g.bookingRef)
    if (same) existing.value = { id: same.id, name: same.name }
  }
}

async function pickFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  busy.value = true
  error.value = ''
  try {
    text.value = await fileToText(file)
    source.value = file.name
    await analyse()
  } catch (err) {
    error.value = (err as Error).message || 'Datei konnte nicht gelesen werden.'
  } finally {
    busy.value = false
  }
}

async function paste() {
  try {
    text.value = await navigator.clipboard.readText()
    source.value = ''
    await analyse()
  } catch {
    error.value = 'Kein Zugriff auf die Zwischenablage – bitte lange ins Feld tippen und „Einsetzen“ wählen.'
  }
}

const outside = computed(() => {
  const t = trip.value
  if (!t || !guess.value) return false
  const dates = kind.value === 'unterkunft' ? [stay.checkIn, stay.checkOut] : kind.value === 'reise' ? legs.value.map((l) => l.date) : []
  return outsideTrip(dates, t)
})

const note = computed(() => `Aus Buchungsbestätigung eingelesen${source.value ? ` (${source.value})` : ''}.`)

async function save() {
  const t = trip.value
  if (!t || !guess.value) return
  if (kind.value === 'unterkunft') {
    const d = stayDraft({ ...stay, type: stay.type as never }, note.value)
    if (existing.value) {
      const old = await accommodationRepository.get(existing.value.id)
      await accommodationRepository.update(existing.value.id, { ...d, notes: old?.notes || d.notes })
      return router.push(`/trip/${props.tripId}/unterkuenfte/${existing.value.id}`)
    }
    const id = await accommodationRepository.create(props.tripId, d)
    return router.push(`/trip/${props.tripId}/unterkuenfte/${id}`)
  }
  if (kind.value === 'reise') {
    const drafts = legDrafts({ ...guess.value, legs: legs.value }, { startDate: t.startDate, endDate: t.endDate, currency: t.currency }, note.value).map((d, i) => ({
      ...d,
      direction: legs.value[i].direction
    }))
    for (const d of drafts) await travelRepository.create(props.tripId, d)
    return router.push(`/trip/${props.tripId}/anreise`)
  }
  const id = await documentRepository.create(
    props.tripId,
    emptyDocumentDraft({ type: 'buchung', title: docTitle.value || 'Buchung', number: guess.value.bookingRef, status: 'vorhanden', notes: `${note.value}\n\n${excerpt(text.value)}` })
  )
  return router.push(`/trip/${props.tripId}/dokumente/${id}`)
}

function addLeg() {
  legs.value.push({ mode: legs.value[0]?.mode ?? 'bahn', from: '', to: '', date: trip.value?.startDate ?? '', departTime: '', arriveTime: '', number: '', direction: 'hin' })
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="t('Buchung einlesen')" />

  <p class="small text-body-secondary">
    {{ t('Bestätigung einer Unterkunft, eines Flugs, einer Bahn- oder Busfahrt: Text aus Mail oder PDF einfügen – oder die Datei wählen (PDF, gespeicherte E-Mail, Kalendereintrag .ics). Die App liest alles') }} <strong>{{ t('hier auf dem Gerät') }}</strong>{{ t(', nichts wird hochgeladen.') }}
  </p>

  <div class="d-flex flex-wrap gap-2 mb-2">
    <label class="btn btn-primary mb-0" :class="{ disabled: busy }">
      <span v-if="busy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
      <i v-else class="bi bi-file-earmark-arrow-up me-1" aria-hidden="true"></i>{{ t('Datei wählen') }}
      <input type="file" class="d-none" accept=".pdf,.eml,.ics,.html,.htm,.txt,application/pdf,message/rfc822,text/calendar,text/plain,text/html" data-testid="booking-file" @change="pickFile" />
    </label>
    <button type="button" class="btn btn-outline-primary" @click="paste"><i class="bi bi-clipboard me-1" aria-hidden="true"></i>{{ t('Aus Zwischenablage') }}</button>
  </div>
  <label for="bk-text" class="visually-hidden">{{ t('Text der Buchungsbestätigung') }}</label>
  <textarea id="bk-text" v-model="text" rows="6" class="form-control mb-2 font-monospace small" :placeholder="t('… oder Text der Bestätigung hier einfügen')"
            @input="analyse"></textarea>
  <div v-if="error" class="alert alert-danger small py-2">{{ error }}</div>

  <template v-if="guess">
    <div class="d-flex flex-wrap align-items-center gap-2 mb-2 small">
      <span class="text-body-secondary">{{ t('Erkannt:') }}</span>
      <span v-for="f in guess.found" :key="f" class="badge text-bg-light border">{{ f }}</span>
      <span v-if="!guess.found.length" class="text-body-secondary">{{ t('wenig – bitte unten ergänzen') }}</span>
    </div>

    <div class="btn-group mb-3 flex-wrap" role="group" :aria-label="t('Als was übernehmen?')">
      <button type="button" class="btn btn-sm" :class="kind === 'unterkunft' ? 'btn-primary' : 'btn-outline-primary'" @click="kind = 'unterkunft'">
        <i class="bi bi-house-door me-1" aria-hidden="true"></i>{{ t('Unterkunft') }}
      </button>
      <button type="button" class="btn btn-sm" :class="kind === 'reise' ? 'btn-primary' : 'btn-outline-primary'" @click="kind = 'reise'; if (!legs.length) addLeg()">
        <i class="bi bi-signpost-split me-1" aria-hidden="true"></i>{{ t('An-/Rückreise') }}
      </button>
      <button type="button" class="btn btn-sm" :class="kind === 'dokument' ? 'btn-primary' : 'btn-outline-primary'" @click="kind = 'dokument'">
        <i class="bi bi-receipt me-1" aria-hidden="true"></i>{{ t('Nur als Beleg') }}
      </button>
    </div>

    <div v-if="outside" class="alert alert-warning small py-2">
      <i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>{{ t('Die Daten liegen außerhalb dieser Reise ({startDate} – {endDate}). Richtige Reise?', { startDate: trip?.startDate, endDate: trip?.endDate }) }}
    </div>

    <!-- Unterkunft -->
    <section v-if="kind === 'unterkunft'" class="card mb-3">
      <div class="card-body row g-2">
        <div v-if="existing" class="col-12">
          <div class="alert alert-info small py-2 mb-1">{{ t('„{name}“ mit dieser Buchungsnummer gibt es schon – wird aktualisiert.', { name: existing.name }) }}</div>
        </div>
        <div class="col-12 col-md-8"><label class="form-label small" for="bk-name">{{ t('Name') }}</label><input id="bk-name" v-model="stay.name" class="form-control" /></div>
        <div class="col-12 col-md-4">
          <label class="form-label small" for="bk-type">{{ t('Art') }}</label>
          <select id="bk-type" v-model="stay.type" class="form-select"><option v-for="(l, k) in TYPES" :key="k" :value="k">{{ l }}</option></select>
        </div>
        <div class="col-12"><label class="form-label small" for="bk-addr">{{ t('Adresse') }}</label><input id="bk-addr" v-model="stay.address" class="form-control" /></div>
        <div class="col-6 col-md-3"><label class="form-label small" for="bk-in">{{ t('Anreise') }}</label><input id="bk-in" v-model="stay.checkIn" type="date" class="form-control" /></div>
        <div class="col-6 col-md-3"><label class="form-label small" for="bk-out">{{ t('Abreise') }}</label><input id="bk-out" v-model="stay.checkOut" type="date" class="form-control" /></div>
        <div class="col-6 col-md-3"><label class="form-label small" for="bk-price">{{ t('Preis') }}</label>
          <div class="input-group"><input id="bk-price" v-model.number="stay.price" type="number" step="0.01" class="form-control" /><span class="input-group-text">{{ stay.currency }}</span></div>
        </div>
        <div class="col-6 col-md-3"><label class="form-label small" for="bk-cancel">{{ t('Kostenlos stornierbar bis') }}</label><input id="bk-cancel" v-model="stay.cancelUntil" type="date" class="form-control" /></div>
        <div class="col-12 col-md-6"><label class="form-label small" for="bk-ref">{{ t('Buchungsnummer') }}</label><input id="bk-ref" v-model="stay.bookingRef" class="form-control" /></div>
        <div class="col-12 col-md-6"><label class="form-label small" for="bk-url">{{ t('Link') }}</label><input id="bk-url" v-model="stay.url" type="url" class="form-control" /></div>
      </div>
    </section>

    <!-- Etappen -->
    <section v-else-if="kind === 'reise'" class="mb-3">
      <div v-for="(l, i) in legs" :key="i" class="card mb-2">
        <div class="card-body row g-2">
          <div class="col-6 col-md-3">
            <label class="form-label small" :for="`lg-dir-${i}`">{{ t('Richtung') }}</label>
            <select :id="`lg-dir-${i}`" v-model="l.direction" class="form-select"><option value="hin">{{ t('Hinreise') }}</option><option value="rueck">{{ t('Rückreise') }}</option></select>
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label small" :for="`lg-mode-${i}`">{{ t('Verkehrsmittel') }}</label>
            <select :id="`lg-mode-${i}`" v-model="l.mode" class="form-select"><option v-for="(lab, k) in MODES" :key="k" :value="k">{{ lab }}</option></select>
          </div>
          <div class="col-12 col-md-6"><label class="form-label small" :for="`lg-nr-${i}`">{{ t('Flug-/Zugnummer') }}</label><input :id="`lg-nr-${i}`" v-model="l.number" class="form-control" /></div>
          <div class="col-12 col-md-6"><label class="form-label small" :for="`lg-from-${i}`">{{ t('Von') }}</label><input :id="`lg-from-${i}`" v-model="l.from" class="form-control" /></div>
          <div class="col-12 col-md-6"><label class="form-label small" :for="`lg-to-${i}`">{{ t('Nach') }}</label><input :id="`lg-to-${i}`" v-model="l.to" class="form-control" /></div>
          <div class="col-12 col-md-4"><label class="form-label small" :for="`lg-date-${i}`">{{ t('Datum') }}</label><input :id="`lg-date-${i}`" v-model="l.date" type="date" class="form-control" /></div>
          <div class="col-6 col-md-4"><label class="form-label small" :for="`lg-dep-${i}`">{{ t('Abfahrt') }}</label><input :id="`lg-dep-${i}`" v-model="l.departTime" type="time" class="form-control" /></div>
          <div class="col-6 col-md-4"><label class="form-label small" :for="`lg-arr-${i}`">{{ t('Ankunft') }}</label><input :id="`lg-arr-${i}`" v-model="l.arriveTime" type="time" class="form-control" /></div>
          <div class="col-12 text-end"><button type="button" class="btn btn-link btn-sm text-danger p-0" @click="legs.splice(i, 1)">{{ t('Etappe entfernen') }}</button></div>
        </div>
      </div>
      <button type="button" class="btn btn-outline-secondary btn-sm mb-2" @click="addLeg"><i class="bi bi-plus-lg me-1" aria-hidden="true"></i>{{ t('Etappe') }}</button>
      <div class="small text-body-secondary">
        {{ t('Buchungsnummer: {ref} · Preis: {price}', { ref: guess.bookingRef || '–', price: guess.price !== null ? `${guess.price.toLocaleString(intlLocale(), { minimumFractionDigits: 2 })} ${guess.currency}` : '–' }) }}
      </div>
    </section>

    <!-- Beleg -->
    <section v-else class="card mb-3">
      <div class="card-body">
        <label class="form-label small" for="bk-doc">{{ t('Titel') }}</label>
        <input id="bk-doc" v-model="docTitle" class="form-control mb-1" />
        <div class="small text-body-secondary">{{ t('Wird unter Dokumente als „Buchung“ abgelegt – mit Buchungsnummer und einem Auszug des Textes.') }}</div>
      </div>
    </section>

    <button type="button" class="btn btn-primary" :disabled="kind === 'reise' && !legs.length" @click="save">
      <i class="bi bi-check-lg me-1" aria-hidden="true"></i>{{ existing && kind === 'unterkunft' ? 'Aktualisieren' : 'Übernehmen' }}
    </button>
  </template>
</template>
