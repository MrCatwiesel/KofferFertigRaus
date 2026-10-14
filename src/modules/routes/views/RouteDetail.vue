<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useLiveQuery } from '@/core/composables'
import { eachDay } from '@/core/dates'
import { formatDayShort } from '@/core/format'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import RouteMap from '../components/RouteMap.vue'
import { formatDistance, formatDuration, gpxFileName, lacksElevation, profileSvg, toGpx } from '../logic'
import { useOnline } from '@/core/composables'
import { routeRepository } from '../repository'
import { FORMAT_LABEL, ROUTE_COLORS, type Route, type RouteDraft } from '../types'
import { locale } from '@/core/i18n'

const props = defineProps<{ tripId: string; id: string }>()
const router = useRouter()
const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const route = useLiveQuery(() => routeRepository.get(props.id), undefined as Route | undefined, { shallow: true })
const online = useOnline()

// Datei ohne Höhenangaben → Höhen aus dem Geländemodell ergänzen
const eleBusy = ref(false)
const eleMsg = ref('')
const noEle = computed(() => !!route.value && lacksElevation(route.value.points))
async function fillEle() {
  eleBusy.value = true
  eleMsg.value = ''
  try {
    eleMsg.value = (await routeRepository.fillElevations(props.id)) ? '' : 'Höhen konnten nicht abgerufen werden – bitte später noch einmal.'
  } finally {
    eleBusy.value = false
  }
}

const draft = reactive<RouteDraft>({ name: '', color: ROUTE_COLORS[0], date: '', notes: '', showInShare: false })
const loaded = ref(false)
watch(route, (r) => {
  if (r && !loaded.value) {
    Object.assign(draft, { name: r.name, color: r.color, date: r.date, notes: r.notes, showInShare: r.showInShare })
    loaded.value = true
  }
})

// Änderungen kurz nach dem Tippen speichern
let timer: ReturnType<typeof setTimeout> | undefined
watch(
  () => ({ ...draft }),
  (d) => {
    if (!loaded.value) return
    clearTimeout(timer)
    timer = setTimeout(() => routeRepository.update(props.id, { ...d, name: d.name.trim() || 'Route' }), 400)
  },
  { deep: true }
)

const days = computed(() => (trip.value ? eachDay(trip.value.startDate, trip.value.endDate) : []))
const lines = computed(() =>
  route.value ? [{ id: route.value.id, name: draft.name, color: draft.color, points: route.value.points.map((p) => [p[0], p[1]] as [number, number]) }] : []
)
const profile = computed(() => (route.value ? profileSvg(route.value.points, { color: draft.color, width: 440, height: 150 }) : ''))
const facts = computed(() => {
  const s = route.value?.stats
  if (!s) return []
  const time = (t: number | null) => (t === null ? '' : new Date(t * 1000).toLocaleString(locale(), { dateStyle: 'medium', timeStyle: 'short' }))
  return [
    { label: 'Länge', value: formatDistance(s.distance) },
    { label: 'Aufstieg', value: s.ascent ? `${s.ascent.toLocaleString(locale())} m` : '–' },
    { label: 'Abstieg', value: s.descent ? `${s.descent.toLocaleString(locale())} m` : '–' },
    { label: 'Höhe', value: s.minEle !== null ? `${s.minEle.toLocaleString(locale())} – ${s.maxEle!.toLocaleString(locale())} m` : '–' },
    { label: 'Dauer', value: formatDuration(s.duration) || '–' },
    { label: 'Start', value: time(s.start) || '–' }
  ]
})

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

async function exportGpx() {
  if (!route.value) return
  const name = draft.name || 'Route'
  const file = new File([toGpx(name, route.value.points, route.value.kind)], gpxFileName(name), { type: 'application/gpx+xml' })
  try {
    if (navigator.canShare?.({ files: [file] })) return await navigator.share({ files: [file], title: name })
  } catch {
    return
  }
  download(file, file.name)
}

function downloadOriginal() {
  if (route.value?.original) download(route.value.original, route.value.filename)
}

async function remove() {
  if (!route.value || !confirm(`Route „${draft.name}“ löschen?`)) return
  await routeRepository.remove(props.id)
  router.replace(`/trip/${props.tripId}/routen`)
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="draft.name || $t('Route')" />

  <div v-if="!route" class="text-body-secondary">{{ $t('Route nicht gefunden.') }}</div>
  <template v-else>
    <RouteMap :lines="lines" markers height="340px" class="mb-3" />

    <div v-if="profile" class="profile mb-3" :style="{ color: 'var(--bs-body-color)' }" v-html="profile"></div>

    <div class="row g-2 mb-3">
      <div v-for="f in facts" :key="f.label" class="col-6 col-md-4">
        <div class="border rounded p-2 h-100">
          <div class="small text-body-secondary">{{ f.label }}</div>
          <div class="fw-semibold">{{ f.value }}</div>
        </div>
      </div>
    </div>

    <div v-if="noEle" class="alert alert-info d-flex flex-wrap align-items-center gap-2 py-2">
      <span class="flex-grow-1 small"><i class="bi bi-graph-up me-1" aria-hidden="true"></i>{{ $t('Die Datei enthält keine Höhen – daher kein Höhenprofil und keine Höhenmeter.') }}</span>
      <button type="button" class="btn btn-sm btn-primary" :disabled="eleBusy || !online" @click="fillEle">
        <span v-if="eleBusy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>{{ $t('Höhen ergänzen') }}
      </button>
      <div v-if="eleMsg" class="w-100 small text-danger">{{ eleMsg }}</div>
    </div>
    <p v-else-if="route.elevationSource === 'gelaende'" class="small text-body-secondary">
      <i class="bi bi-info-circle me-1" aria-hidden="true"></i>{{ $t('Höhen aus dem Geländemodell ergänzt (Open-Meteo, ca. 90 m Raster) – nicht gemessen.') }}
    </p>

    <section class="card mb-3">
      <div class="card-body">
        <div class="mb-2">
          <label for="r-name" class="form-label small">{{ $t('Name') }}</label>
          <input id="r-name" v-model="draft.name" class="form-control" maxlength="120" />
        </div>
        <div class="row g-2 mb-2">
          <div class="col-12 col-md-6">
            <label for="r-day" class="form-label small">{{ $t('Tag der Reise') }}</label>
            <select id="r-day" v-model="draft.date" class="form-select">
              <option value="">{{ $t('– ohne Tag –') }}</option>
              <option v-for="(d, i) in days" :key="d" :value="d">{{ $t('Tag {0} · {1}', [i + 1, formatDayShort(d)]) }}</option>
              <option v-if="draft.date && !days.includes(draft.date)" :value="draft.date">{{ formatDayShort(draft.date) }}</option>
            </select>
          </div>
          <div class="col-12 col-md-6">
            <span class="form-label small d-block">{{ $t('Farbe') }}</span>
            <div class="d-flex flex-wrap gap-1" role="radiogroup" :aria-label="$t('Farbe')">
              <button v-for="c in ROUTE_COLORS" :key="c" type="button" class="swatch" :class="{ active: draft.color === c }" :style="{ background: c }"
                      :aria-label="`Farbe ${c}`" :aria-pressed="draft.color === c" @click="draft.color = c"></button>
            </div>
          </div>
        </div>
        <div class="mb-2">
          <label for="r-notes" class="form-label small">{{ $t('Notizen') }}</label>
          <textarea id="r-notes" v-model="draft.notes" rows="3" class="form-control" :placeholder="$t('z. B. Parkplatz, Einkehr, Wegbeschaffenheit')"></textarea>
        </div>
        <div class="form-check form-switch">
          <input id="r-share" v-model="draft.showInShare" class="form-check-input" type="checkbox" role="switch" />
          <label class="form-check-label" for="r-share">{{ $t('Auf Reise-Webseite und in Lese-Links zeigen') }}</label>
        </div>
        <div class="form-text">{{ $t('Wird automatisch gespeichert.') }}</div>
      </div>
    </section>

    <div class="d-flex flex-wrap gap-2 mb-2">
      <button type="button" class="btn btn-outline-primary" @click="exportGpx"><i class="bi bi-download me-1" aria-hidden="true"></i>{{ $t('Als GPX (für Garmin)') }}</button>
      <button v-if="route.original" type="button" class="btn btn-outline-secondary" @click="downloadOriginal">
        <i class="bi bi-file-earmark me-1" aria-hidden="true"></i>{{ $t('Originaldatei ({0})', [FORMAT_LABEL[route.format]]) }}
      </button>
      <button type="button" class="btn btn-outline-danger ms-auto" @click="remove"><i class="bi bi-trash me-1" aria-hidden="true"></i>{{ $t('Löschen') }}</button>
    </div>
    <p class="small text-body-secondary">
      {{ $t('GPX aufs Gerät:') }} <strong>{{ $t('GPSMap') }}</strong> {{ $t('per USB in den Ordner') }} <code>Garmin/GPX</code> {{ $t('kopieren (oder Basecamp);') }}
      <strong>{{ $t('Fenix') }}</strong> {{ $t('über Garmin Connect → Training & Planung → Strecken → „Strecke importieren“ und dann ans Gerät senden.') }}
    </p>
  </template>
</template>

<style scoped>
.profile :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
}
.swatch {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 3px solid transparent;
  box-shadow: 0 0 0 1px var(--bs-border-color);
}
.swatch.active {
  border-color: var(--bs-body-bg);
  box-shadow: 0 0 0 2px var(--bs-body-color);
}
</style>
