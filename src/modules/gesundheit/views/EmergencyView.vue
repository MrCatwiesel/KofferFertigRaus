<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLiveQuery } from '@/core/composables'
import { countryName, flag } from '@/core/countries'
import { fileSlug, shareOrDownload } from '@/services/share-file'
import { TripContextHeader, participantsOf, tripRepository, type Trip } from '@/modules/trip/public'
import { contactRepository, telHref } from '@/modules/documents/public'
import { medicationRepository, type Medication } from '@/modules/meds/public'
import { countryFacts, emergencyRows, type EmergencyRow } from '@/modules/laender/public'
import { LANGUAGE_OF_COUNTRY, languageName, loadLanguages, type PhraseLanguage } from '@/modules/sprachfuehrer/public'
import { emergencyMeds, hasContent, medicalCard, passText, personLabel, personsOf, type CardRow } from '../logic'
import { healthRepository } from '../repository'
import type { HealthProfile } from '../types'
import type { PersonCard } from '../pdf-card'
import BigCard from '../components/BigCard.vue'
import { language, t } from '@/i18n'

/** Notfall-Seite: Notruf des Landes, Allergien und Erkrankungen aller Mitreisenden in der Landessprache, eigene Nummern */
const props = defineProps<{ tripId: string }>()
const route = useRoute()
const router = useRouter()
const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const profiles = useLiveQuery(() => healthRepository.listByTrip(props.tripId), [] as HealthProfile[])
const meds = useLiveQuery(() => medicationRepository.listByTrip(props.tripId), [] as Medication[])
const contacts = useLiveQuery(() => contactRepository.listByTrip(props.tripId), [] as Awaited<ReturnType<typeof contactRepository.listByTrip>>)
const languages = shallowRef<Record<string, PhraseLanguage>>({})
onMounted(async () => (languages.value = await loadLanguages()))

// Land: aus der Adresse (?land=IT), sonst das erste Ziel
const countries = computed(() => [...new Set([...(trip.value?.countries ?? []), ...(trip.value?.transit ?? [])])])
const country = computed(() => {
  const q = typeof route.query.land === 'string' ? route.query.land : ''
  return countries.value.includes(q) ? q : (countries.value[0] ?? '')
})
const facts = computed(() => (country.value ? countryFacts(country.value) : undefined))
const numbers = computed<EmergencyRow[]>(() => (facts.value ? emergencyRows(facts.value.emergency) : [{ label: t('Notruf'), number: '112', main: true }]))

// Sprache der Karten: Landessprache (bei mehreren wählbar); unbekannt → Englisch; wie die App → nur App-Sprache
const countryLangs = computed(() => (LANGUAGE_OF_COUNTRY[country.value] ?? []).filter((l) => l !== language()))
const langChoices = computed(() => {
  if (countryLangs.value.length) return countryLangs.value
  const known = LANGUAGE_OF_COUNTRY[country.value] ?? []
  return known.includes(language()) || language() === 'en' ? [] : ['en']
})
const code = computed(() => {
  const q = typeof route.query.sprache === 'string' ? route.query.sprache : ''
  if (q && q !== language() && languages.value[q]) return q
  return langChoices.value[0] ?? ''
})
const lang = computed(() => (code.value ? (languages.value[code.value] ?? null) : null))
const others = computed(() => Object.keys(languages.value).filter((l) => l !== language() && !langChoices.value.includes(l)).sort((a, b) => languageName(a).localeCompare(languageName(b), language())))
const choose = (q: Record<string, string | undefined>) => router.replace({ query: { ...route.query, ...q } })

// Personen mit Angaben
const persons = computed(() => personsOf(participantsOf(trip.value), profiles.value))
const cards = computed(() =>
  persons.value
    .map((person) => {
      const p = profiles.value.find((x) => x.person === person)
      const m = emergencyMeds(meds.value, person)
      if (!hasContent(p) && !m.length) return null
      const card = p ? medicalCard(lang.value, code.value, p) : { rows: [], untranslated: [] }
      return { person, profile: p ?? null, meds: m, ...card }
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
)
const missingPersons = computed(() => persons.value.filter((p) => !cards.value.some((c) => c.person === p)))

// Groß zeigen, Vorlesen, Kopieren
const big = ref<{ title: string; rows: CardRow[] } | null>(null)
const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window
function speak(rows: CardRow[]) {
  if (!canSpeak) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(rows.map((r) => r.text).join(' '))
  u.lang = lang.value?.speech ?? language()
  u.rate = 0.85
  speechSynthesis.speak(u)
}
const copied = ref('')
async function copyPass(c: (typeof cards.value)[number]) {
  const text = passText(c.profile ?? { allergens: [], custom: [], conditions: [], bloodType: '', otherConditions: '', notes: '' }, c.meds)
  try {
    await navigator.clipboard.writeText(text)
    copied.value = c.person
  } catch {
    window.prompt(t('Zum Kopieren markieren:'), text)
  }
}

// Notfallkarte als PDF (erst erzeugen, dann im Klick teilen – sonst verweigert Safari das Teilen-Menü)
const pdfFile = shallowRef<File | null>(null)
const pdfBusy = ref(false)
const pdfError = ref('')
const medLine = (m: Medication[]) => (m.length ? t('Medikamente: {list}', { list: m.map((x) => (x.dose ? `${x.name} (${x.dose})` : x.name)).join(', ') }) : '')
async function makePdf() {
  pdfBusy.value = true
  pdfError.value = ''
  pdfFile.value = null
  try {
    const { createCardPdf } = await import('../pdf-card')
    const front = lang.value ?? (language() !== 'en' ? (languages.value.en ?? null) : null)
    const frontCode = lang.value ? code.value : front ? 'en' : ''
    const list: PersonCard[] = cards.value.map((c) => {
      const extra = [medLine(c.meds), c.profile?.otherConditions ?? '', c.profile?.notes ?? ''].filter(Boolean)
      const back = c.profile ? medicalCard(null, '', c.profile, { restaurant: true }).rows : []
      const frontRows = c.profile && front ? medicalCard(front, frontCode, c.profile, { restaurant: true }).rows : back
      return {
        name: personLabel(c.person),
        front: { languageLabel: front ? languageName(frontCode) : languageName(language()), rows: frontRows, extra: front ? [] : extra },
        back: front ? { languageLabel: languageName(language()), rows: back, extra } : null
      }
    })
    const title = t('Notfallkarte – {trip}', { trip: trip.value?.title ?? '' })
    const blob = await createCardPdf(list, title)
    pdfFile.value = new File([blob], `${fileSlug(t('Notfallkarte'))}-${fileSlug(trip.value?.title ?? '')}.pdf`, { type: 'application/pdf' })
  } catch (e) {
    pdfError.value = (e as Error).message
  } finally {
    pdfBusy.value = false
  }
}
function sharePdf() {
  if (pdfFile.value) void shareOrDownload(pdfFile.value)
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="t('Notfall')" />

  <!-- Land -->
  <div v-if="countries.length > 1" class="d-flex flex-wrap gap-2 mb-3">
    <button v-for="c in countries" :key="c" type="button" class="btn btn-sm" :class="c === country ? 'btn-primary' : 'btn-outline-primary'" :data-country="c" @click="choose({ land: c, sprache: undefined })">
      {{ flag(c) }} {{ countryName(c) }}
    </button>
  </div>

  <!-- Notruf -->
  <section class="mb-3" data-sos-numbers>
    <h2 class="h6 text-body-secondary">
      <i class="bi bi-telephone-fill text-danger me-1" aria-hidden="true"></i>
      <template v-if="country">{{ t('Notruf in {country}', { country: countryName(country) }) }}</template>
      <template v-else>{{ t('Notruf') }}</template>
    </h2>
    <div class="d-grid gap-2">
      <a v-for="n in numbers" :key="n.number" :href="`tel:${n.number}`" class="btn d-flex align-items-center gap-3 text-start" :class="n.main ? 'btn-danger btn-lg' : 'btn-outline-danger'" :data-sos-number="n.number">
        <i class="bi bi-telephone" aria-hidden="true"></i>
        <span class="flex-grow-1">{{ n.label }}</span>
        <strong class="fs-4">{{ n.number }}</strong>
      </a>
    </div>
    <p v-if="country && !facts" class="small text-body-secondary mt-1">{{ t('Für dieses Land kennt die App keine eigene Nummer – 112 funktioniert in Europa und in vielen anderen Ländern.') }}</p>
  </section>

  <!-- Personen -->
  <section class="mb-3">
    <div class="d-flex flex-wrap align-items-center gap-2 mb-2">
      <h2 class="h6 text-body-secondary mb-0 me-auto"><i class="bi bi-heart-pulse text-danger me-1" aria-hidden="true"></i>{{ t('Allergien, Erkrankungen, Medikamente') }}</h2>
      <button v-for="l in langChoices" :key="l" type="button" class="btn btn-sm" :class="l === code ? 'btn-primary' : 'btn-outline-primary'" :data-card-lang="l" @click="choose({ sprache: l })">
        {{ languageName(l) }}
      </button>
      <select class="form-select form-select-sm w-auto" :value="langChoices.includes(code) ? '' : code" :aria-label="t('Andere Sprache')" @change="choose({ sprache: ($event.target as HTMLSelectElement).value || undefined })">
        <option value="">{{ t('Andere Sprache …') }}</option>
        <option v-for="o in others" :key="o" :value="o">{{ languageName(o) }}</option>
      </select>
    </div>

    <div v-if="!cards.length" class="alert alert-info small">
      {{ t('Noch keine Allergien oder Erkrankungen eingetragen.') }}
      <RouterLink :to="`/trip/${tripId}/dokumente?tab=gesundheit`">{{ t('Jetzt eintragen') }}</RouterLink>
    </div>

    <div v-for="c in cards" :key="c.person" class="card border-danger-subtle mb-2" :data-sos-person="c.person">
      <div class="card-body">
        <div class="d-flex align-items-center gap-2 mb-1">
          <h3 class="h6 mb-0 flex-grow-1">{{ personLabel(c.person) }}</h3>
          <RouterLink :to="{ path: `/trip/${tripId}/gesundheit`, query: { person: c.person, zurueck: route.fullPath } }" class="small">{{ t('Ändern') }}</RouterLink>
        </div>
        <div v-if="c.rows.length" :lang="code || undefined" class="sos-text" data-sos-card>
          <div v-for="(r, i) in c.rows" :key="i" :class="{ 'fw-bold text-danger': r.strong }">{{ r.text }}</div>
        </div>
        <div v-if="lang && c.rows.some((r) => r.pron)" class="small fst-italic text-body-secondary mt-1"><div v-for="(r, i) in c.rows" :key="i">{{ r.pron }}</div></div>
        <div v-if="lang && c.rows.length" class="small text-body-secondary mt-1"><div v-for="(r, i) in c.rows" :key="i">{{ r.source }}</div></div>
        <div v-if="c.untranslated.length" class="small text-warning-emphasis mt-1" data-untranslated>
          <i class="bi bi-exclamation-circle me-1" aria-hidden="true"></i>{{ t('Noch nicht auf {language} übersetzt: {list}', { language: languageName(code), list: c.untranslated.join(', ') }) }}
        </div>
        <div v-if="c.meds.length" class="small mt-2" data-sos-meds>
          <i class="bi bi-capsule me-1" aria-hidden="true"></i>{{ medLine(c.meds) }}
        </div>
        <div v-if="c.profile?.otherConditions" class="small mt-1">{{ c.profile.otherConditions }}</div>
        <div v-if="c.profile?.notes" class="small mt-1 text-body-secondary">{{ c.profile.notes }}</div>
        <div class="d-flex flex-wrap gap-2 mt-2">
          <button v-if="c.rows.length" type="button" class="btn btn-sm btn-danger" data-sos-big @click="big = { title: personLabel(c.person), rows: c.rows }">
            <i class="bi bi-arrows-fullscreen me-1" aria-hidden="true"></i>{{ t('Groß zeigen') }}
          </button>
          <button v-if="canSpeak && c.rows.length" type="button" class="btn btn-sm btn-outline-secondary" @click="speak(c.rows)">
            <i class="bi bi-volume-up me-1" aria-hidden="true"></i>{{ t('Vorlesen') }}
          </button>
          <button type="button" class="btn btn-sm btn-outline-secondary" data-copy-pass @click="copyPass(c)">
            <i class="bi me-1" :class="copied === c.person ? 'bi-check-lg' : 'bi-clipboard'" aria-hidden="true"></i>{{ copied === c.person ? t('Kopiert') : t('Für den Notfallpass kopieren') }}
          </button>
        </div>
      </div>
    </div>
    <p v-if="cards.length && missingPersons.length" class="small text-body-secondary">
      {{ t('Ohne Angaben: {names}.', { names: missingPersons.map(personLabel).join(', ') }) }}
      <RouterLink :to="`/trip/${tripId}/dokumente?tab=gesundheit`">{{ t('Eintragen') }}</RouterLink>
    </p>
  </section>

  <!-- Eigene Nummern -->
  <section v-if="contacts.length" class="mb-3">
    <h2 class="h6 text-body-secondary">{{ t('Eigene Notfallnummern') }}</h2>
    <div class="list-group">
      <a v-for="n in contacts" :key="n.id" :href="telHref(n.phone) ?? undefined" class="list-group-item list-group-item-action d-flex align-items-center gap-3">
        <div class="flex-grow-1 min-w-0">
          <div class="fw-semibold">{{ n.label }}</div>
          <div class="small text-body-secondary text-truncate">{{ n.phone }}<template v-if="n.notes"> · {{ n.notes }}</template></div>
        </div>
        <i v-if="telHref(n.phone)" class="bi bi-telephone text-success fs-5" aria-hidden="true"></i>
      </a>
    </div>
  </section>
  <p class="small"><RouterLink :to="`/trip/${tripId}/dokumente?tab=notfall`">{{ t('Notfallnummern bearbeiten') }}</RouterLink></p>

  <!-- PDF -->
  <section v-if="cards.length" class="card mb-3">
    <div class="card-body">
      <h2 class="h6"><i class="bi bi-file-earmark-pdf me-1" aria-hidden="true"></i>{{ t('Notfallkarte zum Ausdrucken') }}</h2>
      <p class="small text-body-secondary mb-2">
        {{ t('Je Person eine Karte im Scheckkartenformat – vorne {front}, hinten {back}. Ausschneiden, falten, zum Ausweis stecken.', { front: languageName(code || (language() !== 'en' ? 'en' : language())), back: languageName(language()) }) }}
      </p>
      <div class="d-flex flex-wrap gap-2">
        <button type="button" class="btn btn-outline-primary" :disabled="pdfBusy || !Object.keys(languages).length" data-card-pdf @click="makePdf">
          <span v-if="pdfBusy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>{{ t('PDF erstellen') }}
        </button>
        <button v-if="pdfFile" type="button" class="btn btn-primary" data-card-pdf-share @click="sharePdf">
          <i class="bi bi-box-arrow-up me-1" aria-hidden="true"></i>{{ t('Teilen / Speichern') }}
        </button>
      </div>
      <div v-if="pdfError" class="small text-danger mt-2">{{ pdfError }}</div>
    </div>
  </section>

  <div class="alert alert-light border small">
    <i class="bi bi-phone me-1" aria-hidden="true"></i>{{ t('Tipp: Ist die App gesperrt, kommen Helfer nicht an diese Seite. Trag das Wichtigste zusätzlich in den Notfallpass deines Telefons ein (iPhone: App „Health“ → Notfallpass) – der lässt sich auch am gesperrten Telefon öffnen. Der Knopf „Für den Notfallpass kopieren“ hilft dabei.') }}
  </div>

  <BigCard v-if="big" :title="big.title" :rows="big.rows" :lang="code" @close="big = null" />
</template>

<style scoped>
.sos-text {
  font-size: 1.15rem;
}
.min-w-0 {
  min-width: 0;
}
</style>
