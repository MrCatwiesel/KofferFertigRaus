<script setup lang="ts">
import { computed, ref } from 'vue'
import { useLiveQuery } from '@/core/composables'
import { formatDayShort } from '@/core/format'
import { requestPersistentStorage } from '@/core/storage'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import RouteMap from '../components/RouteMap.vue'
import { lacksElevation, statsLine, trackSvg } from '../logic'
import { ACCEPT, parseRouteFile } from '../parse'
import { buildRoute, routeRepository } from '../repository'
import type { Route } from '../types'

const props = defineProps<{ tripId: string }>()
const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const routes = useLiveQuery(() => routeRepository.listByTrip(props.tripId), [] as Route[], { shallow: true })

const sorted = computed(() =>
  [...routes.value].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.createdAt.localeCompare(b.createdAt))
)
const lines = computed(() => routes.value.map((r) => ({ id: r.id, name: r.name, color: r.color, points: r.points.map((p) => [p[0], p[1]] as [number, number]) })))
const totals = computed(() => {
  const tracks = routes.value.filter((r) => r.kind === 'track')
  return { km: tracks.reduce((s, r) => s + r.stats.distance, 0), up: tracks.reduce((s, r) => s + r.stats.ascent, 0), n: tracks.length }
})

const busy = ref(false)
const result = ref<{ ok: string; errors: string[] } | null>(null)

async function importFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  if (!files.length) return
  busy.value = true
  requestPersistentStorage()
  const errors: string[] = []
  const created: Route[] = []
  for (const file of files) {
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      const { format, routes: parsed } = await parseRouteFile(file.name, bytes)
      const original = new Blob([bytes], { type: file.type || 'application/octet-stream' })
      parsed.forEach((p, i) => created.push(buildRoute(props.tripId, p, { format, filename: file.name, original }, routes.value.length + created.length + i, trip.value)))
    } catch (e) {
      errors.push((e as Error).message)
    }
  }
  if (created.length) await routeRepository.addMany(created)
  result.value = { ok: created.length ? `${created.length} ${created.length === 1 ? 'Route' : 'Routen'} übernommen.` : '', errors }
  busy.value = false
  // Dateien ohne Höhen: im Hintergrund aus dem Geländemodell ergänzen
  const flat = created.filter((r) => lacksElevation(r.points))
  if (flat.length && navigator.onLine) {
    let n = 0
    for (const r of flat) if (await routeRepository.fillElevations(r.id)) n++
    if (n && result.value) result.value = { ...result.value, ok: `${result.value.ok} Höhen ergänzt für ${n === 1 ? '1 Route' : `${n} Routen`} (Datei ohne Höhenangaben).` }
  }
}

const svgOf = (r: Route) => trackSvg(r.preview, { width: 160, height: 100, color: r.color, stroke: 3 })
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="t('Routen & Touren')" />

  <div class="d-flex flex-wrap gap-2 align-items-center mb-3">
    <label class="btn btn-primary mb-0" :class="{ disabled: busy }">
      <span v-if="busy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
      <i v-else class="bi bi-upload me-1" aria-hidden="true"></i>{{ t('Datei importieren') }}
      <input type="file" :accept="ACCEPT" multiple class="d-none" @change="importFiles" />
    </label>
    <RouterLink :to="`/trip/${tripId}/routen/planen`" class="btn btn-outline-primary"><i class="bi bi-signpost-split me-1" aria-hidden="true"></i>{{ t('Strecke planen') }}</RouterLink>
    <RouterLink :to="`/trip/${tripId}/routen/planen?tab=wanderwege`" class="btn btn-outline-primary"><i class="bi bi-compass me-1" aria-hidden="true"></i>{{ t('Wanderwege suchen') }}</RouterLink>
  </div>
  <p class="small text-body-secondary">{{ t('Importieren: GPX, FIT (Garmin), TCX, KML/KMZ (Google My Maps), GeoJSON') }}</p>

  <div v-if="result" class="alert py-2" :class="result.errors.length ? 'alert-warning' : 'alert-success'">
    <div v-if="result.ok">{{ result.ok }}</div>
    <div v-for="(e, i) in result.errors" :key="i" class="small">{{ e }}</div>
  </div>

  <details class="small mb-3">
    <summary class="text-primary">{{ t('Woher bekomme ich die Dateien?') }}</summary>
    <ul class="mt-2 mb-0">
      <li><strong>{{ t('Garmin Connect') }}</strong> {{ t('(im Browser): Aktivität öffnen → Zahnrad → „In GPX exportieren“ oder „Original exportieren“ (FIT).') }}</li>
      <li><strong>{{ t('Garmin-Gerät per USB') }}</strong> {{ t('am Computer: GPSMap → Ordner') }} <code>Garmin/GPX</code>{{ t(', Fenix →') }} <code>Garmin/Activity</code> (*.fit).</li>
      <li><strong>{{ t('Fertige Routen') }}</strong> {{ t('(z. B. Großglockner Hochalpenstraße): bei Outdooractive, Komoot, Bergfex o. Ä. als GPX herunterladen.') }}</li>
      <li><strong>{{ t('Google') }}</strong>{{ t(': Route in „Google My Maps“ zeichnen → Menü → „Als KML/KMZ exportieren“. (Normale Google-Maps-Routen lassen sich nicht exportieren.)') }}</li>
      <li>{{ t('Auf iPhone/iPad liegen heruntergeladene Dateien in der Dateien-App.') }}</li>
    </ul>
  </details>

  <template v-if="routes.length">
    <RouteMap :lines="lines" height="280px" class="mb-2" @select="(id) => $router.push(`/trip/${tripId}/routen/${id}`)" />
    <p v-if="totals.n" class="small text-body-secondary">
      {{ tn(totals.n, '1 Tour aufgezeichnet', '{n} Touren aufgezeichnet') }} · {{ (totals.km / 1000).toLocaleString(intlLocale(), { maximumFractionDigits: 1 }) }} km · ↗ {{ totals.up.toLocaleString(intlLocale()) }} m
    </p>

    <RouterLink v-for="r in sorted" :key="r.id" :to="`/trip/${tripId}/routen/${r.id}`" class="card mb-2 text-decoration-none text-body route-card">
      <div class="card-body py-2 d-flex gap-3 align-items-center">
        <div class="mini" v-html="svgOf(r)"></div>
        <div class="flex-grow-1 min-w-0">
          <div class="fw-semibold text-truncate">
            <i :class="`bi bi-${r.kind === 'track' ? 'person-walking' : 'signpost-2'} me-1`" :style="{ color: r.color }" aria-hidden="true"></i>{{ r.name }}
          </div>
          <div class="small text-body-secondary">{{ r.date ? formatDayShort(r.date) : 'ohne Tag' }} · {{ statsLine(r.stats) }}</div>
          <div v-if="r.showInShare" class="small text-success"><i class="bi bi-eye me-1" aria-hidden="true"></i>{{ t('auf Webseite/Lese-Link') }}</div>
        </div>
        <i class="bi bi-chevron-right text-body-secondary" aria-hidden="true"></i>
      </div>
    </RouterLink>
  </template>
  <p v-else class="text-body-secondary">{{ t('Noch keine Routen. Importiere eine aufgezeichnete Tour oder eine geplante Strecke.') }}</p>
</template>

<style scoped>
.mini {
  width: 96px;
  flex: 0 0 96px;
  background: var(--bs-tertiary-bg);
  border-radius: var(--bs-border-radius);
}
.mini :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
}
</style>
