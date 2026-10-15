<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useLiveQuery } from '@/core/composables'
import { countryName, flag } from '@/core/countries'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import { ALLERGEN_GROUPS, ALLERGEN_IDS, ALLERGEN_SOURCE, GROUPS, SOURCE, type AllergenId, type PhraseId } from '../phrases'
import { LANGUAGES } from '../languages'
import { allergyCard, languageName, matchAllergen, nearbyNote, phrasesIn, tripLanguages } from '../logic'
import { loadAllergens, loadCustomAllergens, saveAllergens, saveCustomAllergens, type CustomAllergen } from '../settings'
import { newId } from '@/core/db'
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

// Allergien (nur auf diesem Gerät)
const allergens = ref<AllergenId[]>([])
const custom = ref<CustomAllergen[]>([])
const editAllergens = ref(false)
onMounted(async () => {
  allergens.value = await loadAllergens()
  custom.value = await loadCustomAllergens()
})
watch(allergens, (list) => void saveAllergens(list), { deep: true })
watch(custom, (list) => void saveCustomAllergens(list), { deep: true })
const hasAllergies = computed(() => allergens.value.length + custom.value.length > 0)
const card = computed(() => (lang.value ? allergyCard(lang.value, current.value, ALLERGEN_IDS.filter((a) => allergens.value.includes(a)), custom.value) : null))
const cardSource = computed(() => [
  SOURCE.allergic,
  [...ALLERGEN_IDS.filter((a) => allergens.value.includes(a)).map((a) => ALLERGEN_SOURCE[a]), ...custom.value.map((c) => c.text)].join(', '),
  SOURCE.without
])

// Eigene Allergie eintippen: bekannte werden angehakt (und übersetzt), unbekannte kommen in die eigene Liste
const newAllergen = ref('')
const addNote = ref('')
function addAllergen() {
  const text = newAllergen.value.trim()
  if (!text) return
  const known = matchAllergen(text)
  if (known) {
    if (!allergens.value.includes(known)) allergens.value.push(known)
    addNote.value = t('„{text}“ kennt die App als „{name}“ – angehakt und wird übersetzt.', { text, name: ALLERGEN_SOURCE[known] })
  } else if (custom.value.some((c) => c.text.toLocaleLowerCase() === text.toLocaleLowerCase())) {
    addNote.value = t('„{text}“ steht schon in deiner Liste.', { text })
  } else {
    custom.value.push({ id: newId(), text, tr: {} })
    addNote.value = ''
  }
  newAllergen.value = ''
}
const removeCustom = (id: string) => (custom.value = custom.value.filter((c) => c.id !== id))
function setTranslation(c: CustomAllergen, value: string) {
  c.tr = { ...c.tr, [current.value]: value }
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
          <button type="button" class="btn btn-sm btn-link ms-auto p-0" data-edit-allergens @click="editAllergens = !editAllergens">
            {{ editAllergens ? t('Fertig') : hasAllergies ? t('Ändern') : t('Allergien wählen') }}
          </button>
        </h2>
        <div v-if="editAllergens || !hasAllergies" class="mb-2">
          <p v-if="!hasAllergies" class="small text-body-secondary mb-2">{{ t('Wähle, wogegen du allergisch bist – die App zeigt dann einen Satz zum Hinhalten im Restaurant. Die Auswahl bleibt nur auf diesem Gerät.') }}</p>
          <template v-if="editAllergens">
            <div v-for="grp in ALLERGEN_GROUPS" :key="grp.title" class="mb-2">
              <div class="small fw-semibold text-body-secondary mb-1">{{ grp.title }}</div>
              <div class="row row-cols-2 row-cols-md-3 g-1">
                <div v-for="a in grp.ids" :key="a" class="col">
                  <div class="form-check">
                    <input :id="`allergen-${a}`" v-model="allergens" class="form-check-input" type="checkbox" :value="a" />
                    <label class="form-check-label small" :for="`allergen-${a}`">{{ ALLERGEN_SOURCE[a] }}</label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Eigene Allergien -->
            <div class="small fw-semibold text-body-secondary mt-3 mb-1">{{ t('Weitere Allergie') }}</div>
            <form class="input-group input-group-sm" @submit.prevent="addAllergen">
              <input id="own-allergen" v-model="newAllergen" class="form-control" list="allergen-names" :placeholder="t('z. B. Koriander')" :aria-label="t('Weitere Allergie')" autocomplete="off" />
              <button class="btn btn-outline-primary" type="submit" :disabled="!newAllergen.trim()" data-add-allergen>
                <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>{{ t('Hinzufügen') }}
              </button>
            </form>
            <datalist id="allergen-names">
              <option v-for="a in ALLERGEN_IDS" :key="a" :value="ALLERGEN_SOURCE[a]" />
            </datalist>
            <div v-if="addNote" class="small text-success mt-1" data-add-note>{{ addNote }}</div>
            <ul v-if="custom.length" class="list-group list-group-flush mt-2" data-own-allergens>
              <li v-for="c in custom" :key="c.id" class="list-group-item px-0 py-2">
                <div class="d-flex align-items-center gap-2">
                  <span class="fw-semibold flex-grow-1">{{ c.text }}</span>
                  <button type="button" class="btn btn-sm btn-link text-body-secondary p-0" :aria-label="t('{name} entfernen', { name: c.text })" @click="removeCustom(c.id)">
                    <i class="bi bi-x-lg" aria-hidden="true"></i>
                  </button>
                </div>
                <input
                  class="form-control form-control-sm mt-1" :lang="current" :value="c.tr[current] ?? ''"
                  :placeholder="t('Auf {language}: …', { language: languageName(current) })" :aria-label="t('{name} auf {language}', { name: c.text, language: languageName(current) })"
                  :data-translate="c.text" @input="setTranslation(c, ($event.target as HTMLInputElement).value)"
                />
              </li>
            </ul>
            <p class="small text-body-secondary mt-2 mb-0">
              {{ t('Wörter, die die App kennt, werden automatisch übersetzt. Für eigene Einträge kann die App ohne Internet nicht übersetzen – trag die Übersetzung je Sprache selbst ein (z. B. aus einer Übersetzungs-App oder vom Arzt). Ohne Übersetzung erscheint das Wort so, wie du es eingegeben hast.') }}
            </p>
          </template>
        </div>
        <template v-if="card">
          <div :lang="current" class="allergy-text" data-allergy-text>
            <div v-for="(line, i) in card.lines" :key="i" :class="{ 'fw-bold text-danger': i === 1 }">{{ line }}</div>
          </div>
          <div v-if="card.pron.length" class="small fst-italic text-body-secondary mt-1"><div v-for="(p, i) in card.pron" :key="i">{{ p }}</div></div>
          <div class="small text-body-secondary mt-1"><div v-for="(p, i) in cardSource" :key="i">{{ p }}</div></div>
          <div v-if="card.untranslated.length && !editAllergens" class="small text-warning-emphasis mt-1" data-untranslated>
            <i class="bi bi-exclamation-circle me-1" aria-hidden="true"></i>{{ t('Noch nicht auf {language} übersetzt: {list} – unter „Ändern“ eintragen.', { language: languageName(current), list: card.untranslated.join(', ') }) }}
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
