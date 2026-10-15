<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { emptyTripDraft, tripRepository } from '../repository'
import { notifyTripSaved } from '@/core/registry'
import { allCountries, countryName, flag, guessCountries } from '@/core/countries'
import { budgetPerPersonDay, cleanParticipants, formatMoney, tripDays, validateTrip } from '../logic'
import { TRANSPORT_LABELS, type TripDraft } from '../types'
import { linkedMember, mergeLinks, people, type MemberLinks } from '@/core/people'
import { tn } from '@/i18n'

const props = defineProps<{ id?: string }>()
const router = useRouter()

const draft = reactive<TripDraft>(emptyTripDraft())
const submitted = ref(false)
const saving = ref(false)
const isEdit = computed(() => !!props.id)

onMounted(async () => {
  if (!props.id) return
  const trip = await tripRepository.get(props.id)
  if (!trip) return router.replace('/trip')
  // weatherAlerts pflegt das Modul „Unwetter“ selbst – bleibt beim Speichern unberührt (update ändert nur Mitgegebenes)
  const { id: _id, createdAt: _c, updatedAt: _u, weatherAlerts: _w, ...rest } = trip
  Object.assign(draft, { ...rest, participants: [...(rest.participants ?? [])], countries: [...(rest.countries ?? [])] })
  originalLinks.value = { ...(rest.memberLinks ?? {}) }
  links.value = { ...(rest.memberLinks ?? {}) }
})

// Teilnehmer mit Personen verknüpfen (Personen & Rechte) → deren Einträge werden privat
const originalLinks = ref<MemberLinks>({})
const links = ref<MemberLinks>({})
const showLinks = computed(() => people.enabled && people.members.length > 0 && draft.participants.length > 0)
/** Verknüpfung gehört einer anderen Person – nur sie selbst kann sie lösen */
function lockedFor(name: string) {
  const m = linkedMember(people, originalLinks.value, name)
  return !!people.me && !!m && m.id !== people.me.id ? m : null
}
function setLink(name: string, id: string) {
  const next = { ...links.value }
  for (const k of Object.keys(next)) if (id && next[k] === id) delete next[k]
  if (id) next[name] = id
  else delete next[name]
  links.value = next
}

// Zielländer (für Reise- und Sicherheitshinweise des Auswärtigen Amts)
const countryList = allCountries()
const countryInput = ref('')
const countries = computed(() => draft.countries ?? [])
/** Aus dem Reiseziel erkannte Länder, die noch fehlen */
const suggested = computed(() => guessCountries(draft.destination).filter((c) => !countries.value.includes(c)))
function addCountry(code: string) {
  if (!code || countries.value.includes(code)) return
  draft.countries = [...countries.value, code]
}
function addCountryFromInput() {
  const t = countryInput.value.trim().toLowerCase()
  const hit = countryList.find((c) => c.name.toLowerCase() === t || c.code.toLowerCase() === t)
  if (hit) {
    addCountry(hit.code)
    countryInput.value = ''
  }
}
function removeCountry(code: string) {
  draft.countries = countries.value.filter((c) => c !== code)
}

const newParticipant = ref('')

function addParticipant() {
  const name = newParticipant.value.trim()
  if (!name) return
  draft.participants = cleanParticipants([...draft.participants, name])
  newParticipant.value = ''
  // Personenzahl folgt der Teilnehmerliste
  draft.travelers = Math.max(draft.travelers, draft.participants.length)
}

function removeParticipant(i: number) {
  draft.participants.splice(i, 1)
  if (draft.participants.length) draft.travelers = draft.participants.length
}

const errors = computed(() => validateTrip(draft))
const hasErrors = computed(() => Object.keys(errors.value).length > 0)

const summary = computed(() => {
  if (!draft.startDate || !draft.endDate || errors.value.endDate) return null
  const days = tripDays(draft.startDate, draft.endDate)
  const perDay = budgetPerPersonDay(draft)
  return perDay === null
    ? tn(days, '1 Tag', '{n} Tage')
    : tn(days, '1 Tag · {price} pro Person und Tag', '{n} Tage · {price} pro Person und Tag', { price: formatMoney(perDay, draft.currency) })
})

async function save() {
  submitted.value = true
  if (hasErrors.value) return
  saving.value = true
  try {
    // Leeres Zahlenfeld liefert "" – als "kein Budget" speichern.
    const budget = typeof draft.budget === 'number' && !Number.isNaN(draft.budget) ? draft.budget : null
    const participants = cleanParticipants(draft.participants)
    const travelers = participants.length || draft.travelers
    const memberLinks = mergeLinks(people, originalLinks.value, links.value, participants)
    const plain: TripDraft = { ...draft, budget, participants, travelers, countries: [...(draft.countries ?? [])], title: draft.title.trim(), destination: draft.destination.trim() }
    if (Object.keys(memberLinks).length || Object.keys(originalLinks.value).length) plain.memberLinks = memberLinks
    if (props.id) {
      await tripRepository.update(props.id, plain)
      void notifyTripSaved(props.id) // z. B. Reisehinweise für neue Zielländer holen
      router.push(`/trip/${props.id}`)
    } else {
      const id = await tripRepository.create(plain)
      void notifyTripSaved(id)
      router.push(`/trip/${id}`)
    }
  } finally {
    saving.value = false
  }
}

function invalid(field: keyof TripDraft) {
  return submitted.value && !!errors.value[field]
}
</script>

<template>
  <h1 class="h3 mb-3">{{ isEdit ? t('Reise bearbeiten') : t('Neue Reise') }}</h1>

  <form class="row g-3" novalidate @submit.prevent="save">
    <div class="col-12">
      <label for="title" class="form-label">{{ t('Name der Reise') }}</label>
      <input id="title" v-model="draft.title" class="form-control" :class="{ 'is-invalid': invalid('title') }"
             :placeholder="t('z. B. Sommer am Gardasee')" />
      <div class="invalid-feedback">{{ errors.title }}</div>
    </div>

    <div class="col-12">
      <label for="destination" class="form-label">{{ t('Reiseziel') }}</label>
      <input id="destination" v-model="draft.destination" class="form-control"
             :class="{ 'is-invalid': invalid('destination') }" :placeholder="t('Ort, Region oder Land')" />
      <div class="invalid-feedback">{{ errors.destination }}</div>
    </div>

    <div class="col-12">
      <label for="country" class="form-label">{{ t('Zielländer') }} <span class="small text-body-secondary">{{ t('– für Reisehinweise, Einreise und Impfschutz') }}</span></label>
      <div v-if="countries.length" class="d-flex flex-wrap gap-1 mb-2">
        <span v-for="c in countries" :key="c" class="badge rounded-pill text-bg-light border fs-6 fw-normal">
          {{ flag(c) }} {{ countryName(c) }}
          <button type="button" class="btn-close ms-1 align-middle" style="font-size: 0.6rem" :aria-label="t('{name} entfernen', { name: countryName(c) })" @click="removeCountry(c)"></button>
        </span>
      </div>
      <input id="country" v-model="countryInput" list="country-list" class="form-control" :placeholder="t('Land eingeben, z. B. Österreich')"
             autocomplete="off" @change="addCountryFromInput" @keydown.enter.prevent="addCountryFromInput" />
      <datalist id="country-list">
        <option v-for="c in countryList" :key="c.code" :value="c.name"></option>
      </datalist>
      <div v-if="suggested.length" class="mt-1 small">
        {{ t('Erkannt:') }}
        <button v-for="c in suggested" :key="c" type="button" class="btn btn-sm btn-outline-primary py-0 ms-1" @click="addCountry(c)">{{ t('{flag} {countryName} hinzufügen', { flag: flag(c), countryName: countryName(c) }) }}</button>
      </div>
      <div class="form-text">{{ t('Nach dem Speichern holt die App die Reise- und Sicherheitshinweise des Auswärtigen Amts und trägt Einreise, Impfschutz und Sicherheitslage in die Dokumente ein.') }}</div>
    </div>

    <div class="col-6">
      <label for="start" class="form-label">{{ t('Von') }}</label>
      <input id="start" v-model="draft.startDate" type="date" class="form-control"
             :class="{ 'is-invalid': invalid('startDate') }" />
      <div class="invalid-feedback">{{ errors.startDate }}</div>
    </div>
    <div class="col-6">
      <label for="end" class="form-label">{{ t('Bis') }}</label>
      <input id="end" v-model="draft.endDate" type="date" class="form-control" :min="draft.startDate"
             :class="{ 'is-invalid': invalid('endDate') }" />
      <div class="invalid-feedback">{{ errors.endDate }}</div>
    </div>

    <div class="col-12">
      <label for="participant" class="form-label">{{ t('Wer reist mit?') }}</label>
      <div v-if="draft.participants.length" class="d-flex flex-wrap gap-2 mb-2">
        <span v-for="(p, i) in draft.participants" :key="p" class="badge rounded-pill text-bg-primary d-flex align-items-center gap-1 fs-6 fw-normal">
          <i class="bi bi-person" aria-hidden="true"></i>{{ p }}
          <button type="button" class="btn-close btn-close-white ms-1" style="font-size: 0.6rem" :aria-label="t('{name} entfernen', { name: p })"
                  @click="removeParticipant(i)"></button>
        </span>
      </div>
      <div class="input-group">
        <input id="participant" v-model="newParticipant" class="form-control" :placeholder="t('Name, z. B. Ich oder Anna')"
               @keydown.enter.prevent="addParticipant" />
        <button type="button" class="btn btn-outline-primary" @click="addParticipant">
          <i class="bi bi-person-plus" aria-hidden="true"></i><span class="visually-hidden">{{ t('Hinzufügen') }}</span>
        </button>
      </div>
      <div class="form-text">{{ t('Optional. Damit lassen sich Packliste, Medikamente und Dokumente pro Person trennen.') }}</div>
      <div v-if="showLinks" class="border rounded p-2 mt-2" data-member-links>
        <div class="small fw-semibold mb-1"><i class="bi bi-person-lock me-1" aria-hidden="true"></i>{{ t('Mit Konto verknüpfen') }}</div>
        <div v-for="p in draft.participants" :key="p" class="d-flex align-items-center gap-2 py-1">
          <span class="flex-grow-1 small">{{ p }}</span>
          <span v-if="lockedFor(p)" class="small text-body-secondary"><i class="bi bi-lock me-1" aria-hidden="true"></i>{{ lockedFor(p)!.name }}</span>
          <select v-else class="form-select form-select-sm w-auto" :value="links[p] ?? ''" :aria-label="t('Konto für {p}', { p })" @change="setLink(p, ($event.target as HTMLSelectElement).value)">
            <option value="">{{ t('– nicht verknüpft –') }}</option>
            <option v-for="m in people.members" :key="m.id" :value="m.id">{{ m.name }}{{ m.id === people.me?.id ? ' ' + t('(ich)') : '' }}</option>
          </select>
        </div>
        <div class="form-text mt-1">{{ t('Verknüpfte Personen sehen ihre Packliste, Medikamente und Dokumente privat – nur für sich. Nicht verknüpfte (z. B. Kinder) sieht die ganze Gruppe.') }}</div>
      </div>
      <div v-if="invalid('participants')" class="text-danger small">{{ errors.participants }}</div>
    </div>

    <div class="col-6 col-md-4">
      <label for="travelers" class="form-label">{{ t('Personen') }}</label>
      <input id="travelers" v-model.number="draft.travelers" type="number" min="1" step="1" class="form-control"
             :disabled="draft.participants.length > 0" :title="draft.participants.length ? t('Ergibt sich aus den Teilnehmern') : undefined"
             :class="{ 'is-invalid': invalid('travelers') }" />
      <div class="invalid-feedback">{{ errors.travelers }}</div>
    </div>
    <div class="col-6 col-md-4">
      <label for="transport" class="form-label">{{ t('Anreise') }}</label>
      <select id="transport" v-model="draft.transport" class="form-select">
        <option v-for="(label, key) in TRANSPORT_LABELS" :key="key" :value="key">{{ label }}</option>
      </select>
    </div>
    <div class="col-12 col-md-4">
      <label for="budget" class="form-label">{{ t('Budget gesamt') }}</label>
      <div class="input-group has-validation">
        <input id="budget" v-model.number="draft.budget" type="number" min="0" step="50" class="form-control"
               :class="{ 'is-invalid': invalid('budget') }" :placeholder="t('optional')" />
        <select v-model="draft.currency" class="form-select flex-grow-0 w-auto" :aria-label="t('Währung')">
          <option>{{ t('EUR') }}</option><option>{{ t('CHF') }}</option><option>{{ t('USD') }}</option><option>{{ t('GBP') }}</option>
        </select>
        <div class="invalid-feedback">{{ errors.budget }}</div>
      </div>
    </div>

    <div class="col-12">
      <label for="notes" class="form-label">{{ t('Notizen') }}</label>
      <textarea id="notes" v-model="draft.notes" rows="3" class="form-control"
                :placeholder="t('Ideen, Wünsche, Links …')"></textarea>
    </div>

    <div v-if="summary" class="col-12">
      <div class="alert alert-light border mb-0 py-2">
        <i class="bi bi-calendar-range me-1" aria-hidden="true"></i>{{ summary }}
      </div>
    </div>

    <div class="col-12 d-flex gap-2">
      <button type="submit" class="btn btn-primary" :disabled="saving">
        <i class="bi bi-check-lg me-1" aria-hidden="true"></i>{{ t('Speichern') }}
      </button>
      <button type="button" class="btn btn-outline-secondary" @click="router.back()">{{ t('Abbrechen') }}</button>
    </div>
  </form>
</template>
