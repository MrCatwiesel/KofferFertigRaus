<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLiveQuery } from '@/core/composables'
import { countryName, flag } from '@/core/countries'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import { ALLERGEN_IDS, ALLERGEN_SOURCE, GROUPS, SOURCE, type PhraseId } from '../phrases'
import { LANGUAGES } from '../languages'
import { allergyCard, languageName, nearbyNote, phrasesIn, tripLanguages } from '../logic'
import { DeviceAllergyTakeover, hasAllergies, healthRepository, personLabel, type HealthProfile } from '@/modules/gesundheit/public'
import { myParticipant, people } from '@/core/people'
import { language, t } from '@/i18n'

const props = defineProps<{ tripId: string }>()
const route = useRoute()
const router = useRouter()
const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)

const countries = computed(() => [...(trip.value?.countries ?? []), ...(trip.value?.transit ?? [])])
const langs = computed(() => tripLanguages(countries.value, LANGUAGES))
const others = computed(() =>
  Object.keys(LANGUAGES)
    .filter((l) => l !== language())
    .map((l) => ({ code: l, name: languageName(l) }))
    .sort((a, b) => a.name.localeCompare(b.name, language()))
)

// Gewählte Sprache: aus der Adresse, sonst die erste der Reise
const current = computed(() => {
  const q = typeof route.query.sprache === 'string' ? route.query.sprache : ''
  return LANGUAGES[q] && q !== language() ? q : (langs.value[0]?.lang ?? '')
})
const lang = computed(() => (current.value ? LANGUAGES[current.value] : null))
const choose = (code: string) => router.replace({ query: { ...route.query, sprache: code || undefined } })
const notes = computed(() => {
  const hit = langs.value.find((l) => l.lang === current.value)
  return (hit?.countries ?? []).map((c) => nearbyNote(c, current.value)).filter((n): n is string => !!n)
})

// Allergien gehören seit 1.43 zur Person (Modul „Gesundheit & Notfall“, abgeglichen)
const profiles = useLiveQuery(() => healthRepository.listByTrip(props.tripId), [] as HealthProfile[])
const withAllergies = computed(() => profiles.value.filter(hasAllergies).sort((a, b) => order(a.person) - order(b.person)))
const order = (p: string) => {
  const i = trip.value?.participants.indexOf(p) ?? -1
  return i < 0 ? 999 : i
}
const chosenPerson = ref<string | null>(null)
const selected = computed(() => {
  const list = withAllergies.value
  const mine = myParticipant(people, trip.value?.memberLinks)
  return list.find((p) => p.person === chosenPerson.value) ?? list.find((p) => p.person === mine) ?? list[0] ?? null
})
const persons = computed(() => personsOfTrip(trip.value?.participants ?? []))
const personsOfTrip = (list: string[]) => (list.length ? list : [''])
const editTo = computed(() => ({
  path: `/trip/${props.tripId}/gesundheit`,
  query: { person: selected.value?.person ?? (myParticipant(people, trip.value?.memberLinks) || persons.value[0]), zurueck: route.fullPath }
}))
const card = computed(() => (lang.value && selected.value ? allergyCard(lang.value, current.value, ALLERGEN_IDS.filter((a) => selected.value!.allergens.includes(a)), selected.value.custom) : null))
const cardSource = computed(() =>
  selected.value
    ? [SOURCE.allergic, [...ALLERGEN_IDS.filter((a) => selected.value!.allergens.includes(a)).map((a) => ALLERGEN_SOURCE[a]), ...selected.value.custom.map((c) => c.text)].join(', '), SOURCE.without]
    : []
)
const untranslatedItems = computed(() => (selected.value ? selected.value.custom.filter((c) => !c.tr[current.value]?.trim()) : []))
function setTranslation(customId: string, value: string) {
  if (selected.value && value.trim()) void healthRepository.setTranslation(props.tripId, selected.value.person, customId, current.value, value.trim())
}

// Vorlesen (Stimmen des Geräts – auf iPad/iPhone meist auch offline)
const canSpeak = typeof window !== 'undefined' && 'speechSynthesis' in window
function speak(text: string) {
  if (!canSpeak || !lang.value) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text.replace(/…/g, ', '))
  u.lang = lang.value.speech
  u.rate = 0.85
  speechSynthesis.speak(u)
}
onBeforeUnmount(() => canSpeak && speechSynthesis.cancel())

// Groß zeigen (zum Hinhalten)
const big = ref<{ lines: string[]; pron: string[]; source: string[] } | null>(null)
function showBig(id: PhraseId) {
  if (!lang.value) return
  big.value = { lines: [lang.value.phrases[id] ?? ''], pron: lang.value.pron?.phrases[id] ? [lang.value.pron.phrases[id]!] : [], source: [SOURCE[id]] }
}
function showCard() {
  if (card.value) big.value = { lines: card.value.lines, pron: card.value.pron, source: cardSource.value }
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="t('Sprachführer')" />

  <!-- Sprachwahl -->
  <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
    <button
      v-for="l in langs" :key="l.lang" type="button" class="btn btn-sm" :class="l.lang === current ? 'btn-primary' : 'btn-outline-primary'"
      :data-lang="l.lang" @click="choose(l.lang)"
    >
      {{ l.countries.map(flag).join('') }} {{ languageName(l.lang) }}
    </button>
    <select id="phrase-lang" class="form-select form-select-sm w-auto" :value="langs.some((l) => l.lang === current) ? '' : current" :aria-label="t('Andere Sprache')" @change="choose(($event.target as HTMLSelectElement).value)">
      <option value="">{{ langs.length ? t('Andere Sprache …') : t('Sprache wählen …') }}</option>
      <option v-for="o in others" :key="o.code" :value="o.code">{{ o.name }}</option>
    </select>
  </div>

  <div v-if="trip && !lang" class="alert alert-info">
    <template v-if="!countries.length">
      {{ t('Noch kein Zielland angegeben.') }} <RouterLink :to="`/trip/${tripId}/bearbeiten`">{{ t('Reise bearbeiten') }}</RouterLink>
      {{ t('→ „Zielländer“ – oder oben eine Sprache wählen.') }}
    </template>
    <template v-else>
      {{ t('Für {countries} gibt es keine eigene Sprache im Sprachführer – oben lässt sich jede andere wählen.', { countries: countries.map(countryName).join(', ') }) }}
    </template>
  </div>

  <template v-if="lang">
    <p v-for="n in notes" :key="n" class="small text-body-secondary mb-2">{{ n }}</p>

    <!-- Allergie-Karte -->
    <section class="card border-danger-subtle mb-3" data-allergy-card>
      <div class="card-body">
        <h2 class="h6 d-flex align-items-center gap-2 mb-2">
          <i class="bi bi-exclamation-triangle text-danger" aria-hidden="true"></i>{{ t('Allergie-Karte') }}
          <RouterLink :to="editTo" class="btn btn-sm btn-link ms-auto p-0" data-edit-allergens>
            {{ selected ? t('Ändern') : t('Allergien eintragen') }}
          </RouterLink>
        </h2>
        <template v-if="!selected">
          <p class="small text-body-secondary mb-2">{{ t('Trag ein, wogegen jemand allergisch ist – die App zeigt dann einen Satz zum Hinhalten im Restaurant. Die Angaben gehören zur Person und stehen auch unter Dokumente & Notfall.') }}</p>
          <DeviceAllergyTakeover :trip-id="tripId" :persons="persons" @done="(p) => (chosenPerson = p)" />
        </template>
        <div v-if="withAllergies.length > 1" class="d-flex flex-wrap gap-1 mb-2">
          <button v-for="p in withAllergies" :key="p.person" type="button" class="btn btn-sm" :class="p.person === selected?.person ? 'btn-danger' : 'btn-outline-danger'" :data-allergy-person="p.person" @click="chosenPerson = p.person">
            {{ personLabel(p.person) }}
          </button>
        </div>
        <template v-if="card">
          <div :lang="current" class="allergy-text" data-allergy-text>
            <div v-for="(line, i) in card.lines" :key="i" :class="{ 'fw-bold text-danger': i === 1 }">{{ line }}</div>
          </div>
          <div v-if="card.pron.length" class="small fst-italic text-body-secondary mt-1"><div v-for="(p, i) in card.pron" :key="i">{{ p }}</div></div>
          <div class="small text-body-secondary mt-1"><div v-for="(p, i) in cardSource" :key="i">{{ p }}</div></div>
          <div v-if="untranslatedItems.length" class="mt-2" data-untranslated>
            <div class="small text-warning-emphasis mb-1">
              <i class="bi bi-exclamation-circle me-1" aria-hidden="true"></i>{{ t('Noch nicht auf {language} übersetzt – hier eintragen:', { language: languageName(current) }) }}
            </div>
            <input
              v-for="c in untranslatedItems" :key="c.id" class="form-control form-control-sm mb-1" :lang="current"
              :placeholder="t('{name} auf {language}', { name: c.text, language: languageName(current) })" :aria-label="t('{name} auf {language}', { name: c.text, language: languageName(current) })"
              :data-translate="c.text" @change="setTranslation(c.id, ($event.target as HTMLInputElement).value)" @keydown.enter="($event.target as HTMLInputElement).blur()"
            />
          </div>
          <div class="d-flex gap-2 mt-2">
            <button type="button" class="btn btn-sm btn-danger" data-show-card @click="showCard"><i class="bi bi-arrows-fullscreen me-1" aria-hidden="true"></i>{{ t('Groß zeigen') }}</button>
            <button v-if="canSpeak" type="button" class="btn btn-sm btn-outline-secondary" @click="speak(card.lines.join(' '))"><i class="bi bi-volume-up me-1" aria-hidden="true"></i>{{ t('Vorlesen') }}</button>
          </div>
        </template>
      </div>
    </section>

    <!-- Sätze -->
    <section v-for="g in GROUPS" :key="g.id" class="mb-3" :data-group="g.id">
      <h2 class="h6 text-body-secondary"><i :class="`bi bi-${g.icon} me-1`" aria-hidden="true"></i>{{ g.title }}</h2>
      <ul class="list-group">
        <li v-for="id in phrasesIn(lang, g.phrases)" :key="id" class="list-group-item d-flex align-items-center gap-2 py-2" :data-phrase="id">
          <div class="flex-grow-1 min-w-0">
            <div class="fw-semibold" :lang="current">{{ lang.phrases[id] }}</div>
            <div v-if="lang.pron?.phrases[id]" class="small fst-italic text-body-secondary">{{ lang.pron.phrases[id] }}</div>
            <div class="small text-body-secondary">{{ SOURCE[id] }}</div>
          </div>
          <button v-if="canSpeak" type="button" class="btn btn-sm btn-link text-body-secondary p-1" :aria-label="t('Vorlesen: {text}', { text: SOURCE[id] })" @click="speak(lang.phrases[id] ?? '')">
            <i class="bi bi-volume-up fs-5" aria-hidden="true"></i>
          </button>
          <button type="button" class="btn btn-sm btn-link text-body-secondary p-1" :aria-label="t('Groß zeigen: {text}', { text: SOURCE[id] })" @click="showBig(id)">
            <i class="bi bi-arrows-fullscreen" aria-hidden="true"></i>
          </button>
        </li>
      </ul>
    </section>

    <p class="small text-body-secondary">
      {{ t('Alle Sätze sind in der App gespeichert und funktionieren ohne Internet. Vorlesen nutzt die Stimmen des Geräts – fehlt eine, lässt sie sich in den Einstellungen des Geräts laden.') }}
    </p>
  </template>

  <!-- Groß zeigen -->
  <div v-if="big" class="big-view" role="dialog" aria-modal="true" :aria-label="t('Groß zeigen')" data-big @click="big = null">
    <button type="button" class="btn btn-lg btn-light position-absolute top-0 end-0 m-3" :aria-label="t('Schließen')" @click.stop="big = null">
      <i class="bi bi-x-lg" aria-hidden="true"></i>
    </button>
    <div class="big-text" :lang="current">
      <div v-for="(line, i) in big.lines" :key="i">{{ line }}</div>
    </div>
    <div v-if="big.pron.length" class="big-pron fst-italic"><div v-for="(p, i) in big.pron" :key="i">{{ p }}</div></div>
    <div class="big-source"><div v-for="(p, i) in big.source" :key="i">{{ p }}</div></div>
  </div>
</template>

<style scoped>
.min-w-0 {
  min-width: 0;
}
.allergy-text {
  font-size: 1.15rem;
}
.big-view {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: var(--bs-body-bg);
  color: var(--bs-body-color);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: 4rem 1.5rem 2rem;
  gap: 1.5rem;
  overflow-y: auto;
}
.big-text {
  font-size: clamp(2rem, 7vw, 4rem);
  font-weight: 700;
  line-height: 1.2;
}
.big-pron {
  font-size: clamp(1.1rem, 3.5vw, 1.6rem);
  color: var(--bs-secondary-color);
}
.big-source {
  font-size: 1rem;
  color: var(--bs-secondary-color);
}
</style>
