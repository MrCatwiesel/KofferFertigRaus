<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'
import { useLiveQuery } from '@/core/composables'
import { allCountries, countryName, currencyName, currencyOf, flag, inEuRoaming } from '@/core/countries'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import { travelRepository, type TravelLeg } from '@/modules/travel/public'
import { telHref } from '@/modules/documents/public'
import {
  alcoholText,
  emergencyRows,
  factsOf,
  formatDifference,
  lightsText,
  localTime,
  plugFit,
  plugText,
  sheetCountries,
  speedRows,
  timeDifference,
  tipText,
  tollText,
  voltageHint,
  waterText
} from '../logic'
import { t } from '@/i18n'

const props = defineProps<{ tripId: string }>()
const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const legs = useLiveQuery(() => travelRepository.listByTrip(props.tripId), [] as TravelLeg[])

const countries = computed(() => sheetCountries(trip.value))
const byCar = computed(() => trip.value?.transport === 'auto' || legs.value.some((l) => l.mode === 'auto'))

// Uhrzeit vor Ort jede Minute neu
const now = ref(new Date())
const timer = window.setInterval(() => (now.value = new Date()), 30_000)
onBeforeUnmount(() => window.clearInterval(timer))

const tel = (n: string) => telHref(n) ?? undefined

// Durchreiseländer
const choices = computed(() => {
  const taken = new Set(countries.value.map((c) => c.code))
  return allCountries().filter((c) => !taken.has(c.code))
})
const picked = ref('')
async function addTransit() {
  if (!picked.value || !trip.value) return
  await tripRepository.setTransit(props.tripId, [...(trip.value.transit ?? []), picked.value])
  picked.value = ''
}
async function removeTransit(code: string) {
  if (!trip.value) return
  await tripRepository.setTransit(props.tripId, (trip.value.transit ?? []).filter((c) => c !== code))
}

const plugClass = (plugs: string) => ({ passt: 'text-success', euro: 'text-warning-emphasis', adapter: 'text-danger' })[plugFit(plugs)]
const waterIcon = { ja: 'bi-check-circle text-success', teils: 'bi-exclamation-circle text-warning-emphasis', nein: 'bi-x-circle text-danger' }
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="t('Länder-Spickzettel')" />

  <div v-if="trip && !countries.length" class="alert alert-info">
    {{ t('Noch kein Zielland angegeben.') }} <RouterLink :to="`/trip/${tripId}/bearbeiten`">{{ t('Reise bearbeiten') }}</RouterLink>
    {{ t('→ „Zielländer“ – danach steht hier, was man vor Ort wissen sollte: Steckdosen, Notruf, Uhrzeit, Trinkgeld, Leitungswasser und Verkehrsregeln.') }}
  </div>

  <section v-for="c in countries" :key="c.code" class="card mb-3" :data-country="c.code">
    <div class="card-body">
      <h2 class="h5 d-flex flex-wrap align-items-center gap-2 mb-3">
        <span>{{ flag(c.code) }} {{ countryName(c.code) }}</span>
        <span v-if="c.transit" class="badge text-bg-secondary">{{ t('Durchreise') }}</span>
        <button v-if="c.transit" type="button" class="btn btn-sm btn-link text-body-secondary p-0 ms-auto" :aria-label="t('{country} entfernen', { country: countryName(c.code) })" @click="removeTransit(c.code)">
          <i class="bi bi-x-lg" aria-hidden="true"></i>
        </button>
      </h2>

      <template v-if="factsOf(c.code)">
        <div class="row g-2 g-md-3">
          <!-- Notruf -->
          <div class="col-12 col-md-6">
            <div class="fact h-100" data-fact="notruf">
              <div class="fact-title"><i class="bi bi-telephone-plus text-danger me-1" aria-hidden="true"></i>{{ t('Notruf') }}</div>
              <div class="d-flex flex-wrap gap-2">
                <a v-for="r in emergencyRows(factsOf(c.code)!.emergency)" :key="r.number" :href="tel(r.number)" class="btn btn-sm" :class="r.main ? 'btn-danger' : 'btn-outline-danger'">
                  <span class="fw-semibold">{{ r.number }}</span> <span class="small">{{ r.label }}</span>
                </a>
              </div>
            </div>
          </div>
          <!-- Strom -->
          <div class="col-6">
            <div class="fact h-100" data-fact="strom">
              <div class="fact-title"><i class="bi bi-plug me-1" aria-hidden="true"></i>{{ t('Steckdose') }}</div>
              <div>{{ t('Typ {types} · {volt} V', { types: factsOf(c.code)!.plugs.split(' ').join('/'), volt: factsOf(c.code)!.volt }) }}</div>
              <div class="small fw-semibold" :class="plugClass(factsOf(c.code)!.plugs)">{{ plugText(factsOf(c.code)!.plugs) }}</div>
              <div v-if="voltageHint(factsOf(c.code)!.volt)" class="small text-danger">{{ voltageHint(factsOf(c.code)!.volt) }}</div>
            </div>
          </div>
          <!-- Uhrzeit -->
          <div class="col-6">
            <div class="fact h-100" data-fact="zeit">
              <div class="fact-title"><i class="bi bi-clock me-1" aria-hidden="true"></i>{{ t('Uhrzeit') }}</div>
              <template v-if="factsOf(c.code)!.tz">
                <div>{{ t('Jetzt dort: {time}', { time: localTime(factsOf(c.code)!.tz!, now) }) }}</div>
                <div class="small text-body-secondary">{{ formatDifference(timeDifference(factsOf(c.code)!.tz!, now)) }}</div>
              </template>
              <div v-else class="small text-body-secondary">{{ t('Mehrere Zeitzonen – je nach Region') }}</div>
            </div>
          </div>
          <!-- Geld -->
          <div class="col-6">
            <div class="fact h-100" data-fact="geld">
              <div class="fact-title"><i class="bi bi-cash-coin me-1" aria-hidden="true"></i>{{ t('Geld & Trinkgeld') }}</div>
              <div v-if="currencyOf(c.code)">{{ currencyName(currencyOf(c.code)!) }} ({{ currencyOf(c.code) }})</div>
              <div class="small">{{ tipText(factsOf(c.code)!.tip) }}</div>
            </div>
          </div>
          <!-- Handy -->
          <div class="col-6">
            <div class="fact h-100" data-fact="handy">
              <div class="fact-title"><i class="bi bi-phone me-1" aria-hidden="true"></i>{{ t('Handy') }}</div>
              <div>{{ t('Vorwahl +{dial}', { dial: factsOf(c.code)!.dial }) }}</div>
              <div class="small" :class="inEuRoaming(c.code) ? 'text-success' : 'text-danger'">
                {{ inEuRoaming(c.code) ? t('EU-Roaming: telefonieren und surfen wie zu Hause') : t('Kein EU-Roaming – Datenpaket oder eSIM, sonst teuer') }}
              </div>
            </div>
          </div>
          <!-- Wasser -->
          <div class="col-12 col-md-6">
            <div class="fact h-100" data-fact="wasser">
              <div class="fact-title"><i class="bi bi-droplet me-1" aria-hidden="true"></i>{{ t('Leitungswasser') }}</div>
              <div class="small"><i class="bi me-1" :class="waterIcon[factsOf(c.code)!.water]" aria-hidden="true"></i>{{ waterText(factsOf(c.code)!.water) }}</div>
            </div>
          </div>
        </div>

        <!-- Auto -->
        <details class="mt-3 car" :open="byCar" data-fact="auto">
          <summary class="fw-semibold"><i class="bi bi-car-front me-1" aria-hidden="true"></i>{{ t('Mit dem Auto') }}</summary>
          <ul class="list-unstyled mt-2 mb-0 small">
            <li>
              <strong>{{ factsOf(c.code)!.drive === 'L' ? t('Linksverkehr') : t('Rechtsverkehr') }}</strong>
              <template v-if="factsOf(c.code)!.lights"> · {{ lightsText(factsOf(c.code)!.lights!) }}</template>
            </li>
            <li v-if="speedRows(factsOf(c.code)!).length" class="mt-1">
              <span class="text-body-secondary">{{ t('Tempo (Pkw):') }}</span>
              <span class="d-inline-flex flex-wrap column-gap-3">
                <span v-for="r in speedRows(factsOf(c.code)!)" :key="r.label" class="text-nowrap">{{ r.label }} <strong>{{ r.value }}</strong></span>
              </span>
            </li>
            <li v-if="alcoholText(factsOf(c.code)!)" class="mt-1">
              <span class="text-body-secondary">{{ t('Promillegrenze:') }}</span> <strong>{{ alcoholText(factsOf(c.code)!) }}</strong>
            </li>
            <li v-if="factsOf(c.code)!.toll" class="mt-1">
              <span class="text-body-secondary">{{ t('Maut:') }}</span> <span>{{ factsOf(c.code)!.tollNote || tollText(factsOf(c.code)!.toll!) }}</span>
            </li>
          </ul>
        </details>

        <div v-if="factsOf(c.code)!.notes?.length" class="mt-3" data-fact="hinweise">
          <div class="fact-title"><i class="bi bi-lightbulb me-1" aria-hidden="true"></i>{{ t('Gut zu wissen') }}</div>
          <ul class="small mb-0 ps-3">
            <li v-for="n in factsOf(c.code)!.notes" :key="n">{{ n }}</li>
          </ul>
        </div>
      </template>
      <p v-else class="small text-body-secondary mb-0">
        {{ t('Für dieses Land gibt es noch keinen Spickzettel.') }}
        <template v-if="currencyOf(c.code)"> {{ t('Währung: {currency}.', { currency: currencyName(currencyOf(c.code)!) }) }}</template>
        {{ inEuRoaming(c.code) ? t('EU-Roaming gilt.') : t('Kein EU-Roaming.') }}
      </p>
    </div>
  </section>

  <section v-if="trip" class="card mb-3">
    <div class="card-body">
      <h2 class="h6">{{ t('Durchreiseländer') }}</h2>
      <p class="small text-body-secondary">{{ t('Länder, durch die ihr nur fahrt – z. B. für Vignette, Tempo und Notruf unterwegs. Sie erscheinen auch in den Packlisten-Vorschlägen.') }}</p>
      <div class="d-flex flex-wrap gap-2">
        <select id="transit-country" v-model="picked" class="form-select form-select-sm w-auto" :aria-label="t('Land')">
          <option value="">{{ t('Land wählen …') }}</option>
          <option v-for="o in choices" :key="o.code" :value="o.code">{{ flag(o.code) }} {{ o.name }}</option>
        </select>
        <button type="button" class="btn btn-sm btn-outline-primary" :disabled="!picked" data-add-transit @click="addTransit">
          <i class="bi bi-plus-lg me-1" aria-hidden="true"></i>{{ t('Hinzufügen') }}
        </button>
      </div>
    </div>
  </section>

  <p v-if="countries.length" class="mb-3">
    <RouterLink :to="`/trip/${tripId}/sprachfuehrer`" class="btn btn-sm btn-outline-primary" data-phrasebook-link>
      <i class="bi bi-translate me-1" aria-hidden="true"></i>{{ t('Wichtige Sätze in der Landessprache') }}
    </RouterLink>
  </p>

  <p class="small text-body-secondary">
    <Tx text="Stand Oktober 2026, ohne Gewähr – Regeln ändern sich, vor Ort gelten die Schilder. Einreise, Sicherheit und Impfungen stehen unter {link}.">
      <template #link><RouterLink :to="`/trip/${tripId}/reisehinweise`">{{ t('Reisehinweise') }}</RouterLink></template>
    </Tx>
  </p>
</template>

<style scoped>
.fact {
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius);
  padding: 0.6rem 0.75rem;
}
.fact-title {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  color: var(--bs-secondary-color);
  margin-bottom: 0.25rem;
}
.car {
  border-top: 1px solid var(--bs-border-color);
  padding-top: 0.5rem;
}
</style>
