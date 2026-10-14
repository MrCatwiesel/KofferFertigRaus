<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useLiveQuery, useOnline } from '@/core/composables'
import { countryName, flag } from '@/core/countries'
import { formatDate, safeUrl } from '@/core/format'
import { todayIso } from '@/core/dates'
import { syncState } from '@/core/sync/engine'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import { unwetterRepository } from '../repository'
import { refreshUnwetter } from '../refresh'
import { aktuelle, betrifftReise, imZeitfenster, VORLAUF_TAGE, wo, zeitraum } from '../logic'
import { ART_ICON, QUELLE_URL, STUFE_STIL, type UnwetterStand, type Warnung } from '../types'

const props = defineProps<{ tripId: string }>()
const online = useOnline()
const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const stand = useLiveQuery(() => unwetterRepository.get(props.tripId), undefined as UnwetterStand | undefined)
const busy = ref(false)
const error = ref('')
const noPlace = ref(false)

const liste = computed(() => aktuelle(stand.value))
const amOrt = computed(() => liste.value.filter((w) => !w.ortlos))
const imLand = computed(() => liste.value.filter((w) => w.ortlos))
const fenster = computed(() => !!trip.value && imZeitfenster(trip.value, todayIso()))
// Server nennt Länder als Code („CH: MeteoAlarm nicht erreichbar.“)
const fehler = computed(() => [...(stand.value?.fehler ?? []).map((f) => f.replace(/^([A-Z]{2}):/, (_, c: string) => `${countryName(c)}:`)), ...(error.value ? [error.value] : [])])

async function refresh() {
  busy.value = true
  error.value = ''
  try {
    noPlace.value = !(await refreshUnwetter(props.tripId))
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  const s = stand.value
  if (syncState.configured && online.value && (!s || Date.now() - Date.parse(s.fetchedAt) > 10 * 60_000)) void refresh()
})

const stil = (w: Warnung) => STUFE_STIL[w.stufe] ?? STUFE_STIL[2]
const zeit = (iso: string) => new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
const ortNamen = (w: Warnung) => w.orte.map((i) => stand.value?.orte[i]?.name).filter(Boolean).join(', ')
const QUELLE_LABEL = { unterkunft: 'Unterkunft', wetter: 'Wetter-Ort im Tagesplan', ziel: 'Reiseziel' } as const
</script>

<template>
  <TripContextHeader :trip-id="tripId" title="Unwetterwarnungen" />

  <div v-if="!syncState.configured" class="alert alert-info">
    Unwetterwarnungen kommen über den eigenen Server – er ordnet die Orte der Reise den Warnregionen zu und schickt auf Wunsch Benachrichtigungen.
    Erst den <RouterLink to="/abgleich">Geräte-Abgleich</RouterLink> einrichten.
  </div>

  <template v-else>
    <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
      <button type="button" class="btn btn-outline-primary btn-sm" :disabled="busy || !online" data-unwetter-refresh @click="refresh">
        <span v-if="busy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
        <i v-else class="bi bi-arrow-clockwise me-1" aria-hidden="true"></i>Jetzt aktualisieren
      </button>
      <RouterLink to="/benachrichtigungen" class="btn btn-outline-secondary btn-sm"><i class="bi bi-bell me-1" aria-hidden="true"></i>Benachrichtigungen</RouterLink>
      <span v-if="stand" class="small text-body-secondary">Stand {{ zeit(stand.fetchedAt) }}</span>
    </div>

    <div v-if="!fenster && trip" class="alert alert-light border small">
      <i class="bi bi-info-circle me-1" aria-hidden="true"></i>
      Warnungen gibt es nur für die nächsten Tage. Die App sieht ab {{ VORLAUF_TAGE }} Tage vor der Reise ({{ formatDate(trip.startDate) }}) von selbst nach – hier
      lässt sich jederzeit von Hand nachsehen.
    </div>
    <div v-for="f in fehler" :key="f" class="alert alert-danger py-2 small">{{ f }}</div>
    <div v-if="noPlace" class="alert alert-info small">
      Für diese Reise ist noch kein Ort bekannt. Bei einer <RouterLink :to="`/trip/${tripId}/unterkuenfte`">Unterkunft</RouterLink> die Adresse auf der Karte setzen,
      im <RouterLink :to="`/trip/${tripId}/tagesplan`">Tagesplan</RouterLink> einen Wetter-Ort wählen oder beim Reiseziel einen Ort angeben.
    </div>

    <template v-if="stand">
      <div v-if="!amOrt.length" class="alert alert-success" data-unwetter-keine>
        <i class="bi bi-check-circle me-1" aria-hidden="true"></i>Keine Warnungen an den Orten der Reise.
      </div>

      <section v-for="w in amOrt" :key="w.id" class="card mb-3 warnung" :class="{ 'opacity-75': !betrifftReise(w, stand) }" data-unwetter-warnung>
        <div class="card-body">
          <h2 class="h5 d-flex flex-wrap align-items-center gap-2 mb-1">
            <span class="badge" :class="stil(w).badge"><i :class="`bi bi-${stil(w).icon} me-1`" aria-hidden="true"></i>{{ w.stufeName }}</span>
            <span><i :class="`bi bi-${ART_ICON[w.art] ?? 'exclamation-triangle'} me-1`" aria-hidden="true"></i>{{ w.artName }}</span>
            <span v-if="w.ereignis && w.ereignis !== w.artName" class="small text-body-secondary fw-normal">{{ w.ereignis }}</span>
          </h2>
          <div class="small mb-2">
            <i class="bi bi-clock me-1" aria-hidden="true"></i>{{ zeitraum(w) }} · <i class="bi bi-geo-alt me-1" aria-hidden="true"></i>{{ wo(w) }}
            <span v-if="ortNamen(w)" class="text-body-secondary"> ({{ ortNamen(w) }})</span>
            <span v-if="!betrifftReise(w, stand)" class="badge text-bg-light border ms-1">nicht im Reisezeitraum</span>
          </div>
          <p v-if="w.titel && w.titel !== w.ereignis" class="fw-semibold mb-1">{{ w.titel }}</p>
          <p v-if="w.text" class="small mb-2 pre">{{ w.text }}</p>
          <p v-if="w.hinweis" class="small mb-2 pre"><i class="bi bi-lightbulb me-1" aria-hidden="true"></i>{{ w.hinweis }}</p>
          <div class="small text-body-secondary">
            {{ w.quelle || 'Nationaler Wetterdienst' }}
            <template v-if="safeUrl(w.web)"> · <a :href="safeUrl(w.web)!" target="_blank" rel="noopener">Webseite des Wetterdienstes</a></template>
          </div>
        </div>
      </section>

      <details v-if="imLand.length" class="card mb-3">
        <summary class="card-body py-2 fw-semibold">
          Weitere Warnungen im Land ({{ imLand.length }}) – Ort nicht zuzuordnen
        </summary>
        <div class="card-body pt-0">
          <p class="small text-body-secondary">Für dieses Land kennt der Server die Warnregionen nicht genau. Bitte selbst prüfen, ob dein Ort dabei ist.</p>
          <div v-for="w in imLand" :key="w.id" class="border-top py-2 small">
            <span class="badge me-1" :class="stil(w).badge">{{ w.stufeName }}</span>
            <strong>{{ w.artName }}</strong> · {{ flag(w.land) }} {{ wo(w) }} · {{ zeitraum(w) }}
            <div v-if="w.titel" class="text-body-secondary">{{ w.titel }}</div>
          </div>
        </div>
      </details>

      <div v-if="stand.ohneDaten.length" class="small text-body-secondary mb-3">
        <i class="bi bi-info-circle me-1" aria-hidden="true"></i>Für {{ stand.ohneDaten.map(countryName).join(', ') }} gibt es keine Warnungen über MeteoAlarm (nur Europa).
      </div>

      <details class="small mb-3" data-unwetter-orte>
        <summary>Geprüfte Orte ({{ stand.orte.length }})</summary>
        <ul class="list-unstyled mt-2 mb-0">
          <li v-for="(o, i) in stand.orte" :key="i" class="mb-1">
            <span class="fw-semibold">{{ o.name }}</span>
            <span class="text-body-secondary"> · {{ QUELLE_LABEL[o.quelle] }} · {{ formatDate(o.von) }} – {{ formatDate(o.bis) }}</span>
            <div class="text-body-secondary">
              {{ o.regionen.length ? `Warnregion: ${o.regionen.map((r) => r.name).join(' / ')}` : 'Keine Warnregion (außerhalb von MeteoAlarm)' }}
            </div>
          </li>
        </ul>
      </details>
    </template>

    <p class="small text-body-secondary">
      Quelle: <a :href="QUELLE_URL" target="_blank" rel="noopener">MeteoAlarm</a> (EUMETNET) – amtliche Warnungen der nationalen Wetterdienste. Angaben ohne Gewähr.
      Mit <RouterLink to="/benachrichtigungen">Benachrichtigungen</RouterLink> kommen neue Warnungen (Orange und Rot) aufs Gerät – ab dem Tag vor der Anreise, auch wenn die App geschlossen ist.
    </p>
  </template>
</template>

<style scoped>
.pre {
  white-space: pre-line;
}
.stufe-orange {
  background-color: #fd7e14;
  color: #000;
}
</style>
