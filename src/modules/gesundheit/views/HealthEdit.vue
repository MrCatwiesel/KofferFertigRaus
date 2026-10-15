<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { isMine, linkedMember, people } from '@/core/people'
import { newId } from '@/core/db'
import { TripContextHeader, VisibilitySelect, tripRepository, type Trip } from '@/modules/trip/public'
import { ALLERGEN_GROUPS, ALLERGEN_IDS, ALLERGEN_SOURCE, LANGUAGE_OF_COUNTRY, languageName, loadLanguages, matchAllergen } from '@/modules/sprachfuehrer/public'
import { bloodTypeText, emptyDraft, personLabel } from '../logic'
import { healthRepository } from '../repository'
import { BLOOD_TYPES, CONDITION_IDS, CONDITION_LABEL, type HealthDraft } from '../types'
import { language, t } from '@/i18n'

/** Allergien, Erkrankungen und Blutgruppe einer Person (`?person=Name`) */
const props = defineProps<{ tripId: string }>()
const route = useRoute()
const router = useRouter()
const person = computed(() => (typeof route.query.person === 'string' ? route.query.person : ''))
const back = computed(() => (typeof route.query.zurueck === 'string' && route.query.zurueck.startsWith('/trip/') ? route.query.zurueck : `/trip/${props.tripId}/dokumente?tab=gesundheit`))

const draft = reactive<HealthDraft>(emptyDraft())
const trip = ref<Trip>()
const exists = ref(false)
const allLangs = ref<string[]>([])

onMounted(async () => {
  trip.value = await tripRepository.get(props.tripId)
  if (!trip.value) return router.replace('/trip')
  const p = await healthRepository.get(props.tripId, person.value)
  if (p) {
    exists.value = true
    Object.assign(draft, {
      allergens: [...p.allergens],
      custom: p.custom.map((c) => ({ ...c, tr: { ...c.tr } })),
      conditions: [...p.conditions],
      bloodType: p.bloodType,
      otherConditions: p.otherConditions,
      notes: p.notes,
      sharedWith: p.sharedWith ? [...p.sharedWith] : undefined
    })
  }
  allLangs.value = Object.keys(await loadLanguages()).filter((l) => l !== language())
})

// Gehört der Teilnehmer einer anderen Person (Konto), ändert nur sie selbst
const foreign = computed(() => !!people.me && !!linkedMember(people, trip.value?.memberLinks, person.value) && !isMine(people, trip.value?.memberLinks, person.value))

// Sprachen für die Übersetzung eigener Allergien: die der Reise und alle schon benutzten
const extraLang = ref('')
const transLangs = computed(() => {
  const countries = [...(trip.value?.countries ?? []), ...(trip.value?.transit ?? [])]
  const out = countries.flatMap((c) => LANGUAGE_OF_COUNTRY[c] ?? []).filter((l) => l !== language())
  for (const c of draft.custom) out.push(...Object.keys(c.tr).filter((l) => c.tr[l]?.trim()))
  if (extraLang.value) out.push(extraLang.value)
  return [...new Set(out)]
})

// Eigene Allergie eintippen: bekannte werden angehakt (und übersetzt), unbekannte kommen in die eigene Liste
const newAllergen = ref('')
const addNote = ref('')
function addAllergen() {
  const text = newAllergen.value.trim()
  if (!text) return
  const known = matchAllergen(text)
  if (known) {
    if (!draft.allergens.includes(known)) draft.allergens.push(known)
    addNote.value = t('„{text}“ kennt die App als „{name}“ – angehakt und wird übersetzt.', { text, name: ALLERGEN_SOURCE[known] })
  } else if (draft.custom.some((c) => c.text.toLocaleLowerCase() === text.toLocaleLowerCase())) {
    addNote.value = t('„{text}“ steht schon in deiner Liste.', { text })
  } else {
    draft.custom.push({ id: newId(), text, tr: {} })
    addNote.value = ''
  }
  newAllergen.value = ''
}
const removeCustom = (id: string) => (draft.custom = draft.custom.filter((c) => c.id !== id))

async function save() {
  if (newAllergen.value.trim()) addAllergen()
  await healthRepository.save(props.tripId, person.value, {
    ...draft,
    allergens: ALLERGEN_IDS.filter((a) => draft.allergens.includes(a)),
    conditions: CONDITION_IDS.filter((c) => draft.conditions.includes(c)),
    custom: draft.custom.map((c) => ({ ...c, tr: Object.fromEntries(Object.entries(c.tr).filter(([, v]) => v.trim()).map(([k, v]) => [k, v.trim()])) })),
    otherConditions: draft.otherConditions.trim(),
    notes: draft.notes.trim()
  })
  router.push(back.value)
}

async function remove() {
  if (!confirm(t('Alle Gesundheitsangaben von {name} löschen?', { name: personLabel(person.value) }))) return
  await healthRepository.remove(props.tripId, person.value)
  router.replace(back.value)
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="t('Gesundheit: {name}', { name: personLabel(person) })" />

  <div v-if="foreign" class="alert alert-info small">
    <i class="bi bi-person-lock me-1" aria-hidden="true"></i>{{ t('{name} ist mit einem eigenen Konto verknüpft – nur {name} selbst kann diese Angaben ändern.', { name: personLabel(person) }) }}
  </div>

  <form novalidate @submit.prevent="save">
    <fieldset :disabled="foreign">
      <!-- Allergien -->
      <section class="card mb-3">
        <div class="card-body">
          <h2 class="h6"><i class="bi bi-exclamation-triangle text-danger me-1" aria-hidden="true"></i>{{ t('Allergien') }}</h2>
          <div v-for="grp in ALLERGEN_GROUPS" :key="grp.title" class="mb-2">
            <div class="small fw-semibold text-body-secondary mb-1">{{ grp.title }}</div>
            <div class="row row-cols-2 row-cols-md-3 g-1">
              <div v-for="a in grp.ids" :key="a" class="col">
                <div class="form-check">
                  <input :id="`allergen-${a}`" v-model="draft.allergens" class="form-check-input" type="checkbox" :value="a" />
                  <label class="form-check-label small" :for="`allergen-${a}`">{{ ALLERGEN_SOURCE[a] }}</label>
                </div>
              </div>
            </div>
          </div>

          <div class="small fw-semibold text-body-secondary mt-3 mb-1">{{ t('Weitere Allergie') }}</div>
          <div class="input-group input-group-sm">
            <input id="own-allergen" v-model="newAllergen" class="form-control" list="allergen-names" :placeholder="t('z. B. Koriander')" :aria-label="t('Weitere Allergie')" autocomplete="off" @keydown.enter.prevent="addAllergen" />
            <button class="btn btn-outline-primary" type="button" :disabled="!newAllergen.trim()" data-add-allergen @click="addAllergen">
              <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>{{ t('Hinzufügen') }}
            </button>
          </div>
          <datalist id="allergen-names">
            <option v-for="a in ALLERGEN_IDS" :key="a" :value="ALLERGEN_SOURCE[a]" />
          </datalist>
          <div v-if="addNote" class="small text-success mt-1" data-add-note>{{ addNote }}</div>

          <ul v-if="draft.custom.length" class="list-group list-group-flush mt-2" data-own-allergens>
            <li v-for="c in draft.custom" :key="c.id" class="list-group-item px-0 py-2">
              <div class="d-flex align-items-center gap-2">
                <span class="fw-semibold flex-grow-1">{{ c.text }}</span>
                <button type="button" class="btn btn-sm btn-link text-body-secondary p-0" :aria-label="t('{name} entfernen', { name: c.text })" @click="removeCustom(c.id)">
                  <i class="bi bi-x-lg" aria-hidden="true"></i>
                </button>
              </div>
              <div v-for="l in transLangs" :key="l" class="input-group input-group-sm mt-1">
                <span class="input-group-text lang-label">{{ languageName(l) }}</span>
                <input
                  v-model="c.tr[l]" class="form-control" :lang="l" :placeholder="t('Auf {language}: …', { language: languageName(l) })"
                  :aria-label="t('{name} auf {language}', { name: c.text, language: languageName(l) })" :data-translate="c.text" :data-lang="l"
                />
              </div>
            </li>
          </ul>
          <div v-if="draft.custom.length" class="d-flex align-items-center gap-2 mt-2">
            <select v-model="extraLang" class="form-select form-select-sm w-auto" :aria-label="t('Übersetzung für weitere Sprache')">
              <option value="">{{ t('Übersetzung für weitere Sprache …') }}</option>
              <option v-for="l in allLangs.filter((x) => !transLangs.includes(x))" :key="l" :value="l">{{ languageName(l) }}</option>
            </select>
          </div>
          <p class="small text-body-secondary mt-2 mb-0">
            {{ t('Wörter, die die App kennt, werden automatisch übersetzt. Für eigene Einträge kann die App ohne Internet nicht übersetzen – trag die Übersetzung je Sprache selbst ein (z. B. aus einer Übersetzungs-App oder vom Arzt). Ohne Übersetzung erscheint das Wort so, wie du es eingegeben hast.') }}
          </p>
        </div>
      </section>

      <!-- Erkrankungen -->
      <section class="card mb-3">
        <div class="card-body">
          <h2 class="h6"><i class="bi bi-clipboard2-pulse text-primary me-1" aria-hidden="true"></i>{{ t('Erkrankungen & Blutgruppe') }}</h2>
          <div class="row row-cols-2 g-1 mb-2">
            <div v-for="c in CONDITION_IDS" :key="c" class="col">
              <div class="form-check">
                <input :id="`condition-${c}`" v-model="draft.conditions" class="form-check-input" type="checkbox" :value="c" />
                <label class="form-check-label small" :for="`condition-${c}`">{{ CONDITION_LABEL[c] }}</label>
              </div>
            </div>
          </div>
          <div class="row g-2">
            <div class="col-12 col-sm-4">
              <label for="blood-type" class="form-label small">{{ t('Blutgruppe') }}</label>
              <select id="blood-type" v-model="draft.bloodType" class="form-select form-select-sm">
                <option value="">{{ t('unbekannt') }}</option>
                <option v-for="b in BLOOD_TYPES" :key="b" :value="b">{{ bloodTypeText(b, language()) }}</option>
              </select>
            </div>
            <div class="col-12 col-sm-8">
              <label for="other-conditions" class="form-label small">{{ t('Weitere Erkrankungen') }}</label>
              <input id="other-conditions" v-model="draft.otherConditions" class="form-control form-control-sm" :placeholder="t('z. B. Epilepsie, Herzklappe')" />
            </div>
            <div class="col-12">
              <label for="health-notes" class="form-label small">{{ t('Hinweise für Helfer') }}</label>
              <textarea id="health-notes" v-model="draft.notes" class="form-control form-control-sm" rows="2" :placeholder="t('z. B. Notfallspritze in der Handtasche, Insulin im Kühlschrank')"></textarea>
            </div>
          </div>
          <p class="small text-body-secondary mt-2 mb-0">
            {{ t('Die angehakten Erkrankungen und die Blutgruppe zeigt die Notfall-Seite in der Landessprache; freie Texte erscheinen so, wie du sie schreibst. Medikamente stehen in der Reiseapotheke.') }}
          </p>
        </div>
      </section>

      <div class="mb-3">
        <VisibilitySelect v-model="draft.sharedWith" :trip-id="tripId" :person="person" />
      </div>
    </fieldset>

    <div class="d-flex flex-wrap gap-2">
      <button v-if="!foreign" type="submit" class="btn btn-primary" data-health-save>{{ t('Speichern') }}</button>
      <RouterLink :to="back" class="btn btn-outline-secondary">{{ foreign ? t('Zurück') : t('Abbrechen') }}</RouterLink>
      <button v-if="exists && !foreign" type="button" class="btn btn-outline-danger ms-auto" @click="remove">{{ t('Löschen') }}</button>
    </div>
  </form>
</template>

<style scoped>
.lang-label {
  min-width: 7rem;
}
</style>
