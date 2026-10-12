<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useLiveQuery } from '@/core/composables'
import { eachDay } from '@/core/dates'
import { formatDayShort } from '@/core/format'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import RouteMap from '../components/RouteMap.vue'
import { formatDistance, formatDuration, gpxFileName, profileSvg, toGpx } from '../logic'
import { routeRepository } from '../repository'
import { FORMAT_LABEL, ROUTE_COLORS, type Route, type RouteDraft } from '../types'

const props = defineProps<{ tripId: string; id: string }>()
const router = useRouter()
const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const route = useLiveQuery(() => routeRepository.get(props.id), undefined as Route | undefined)

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
  const time = (t: number | null) => (t === null ? '' : new Date(t * 1000).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' }))
  return [
    { label: 'Länge', value: formatDistance(s.distance) },
    { label: 'Aufstieg', value: s.ascent ? `${s.ascent.toLocaleString('de-DE')} m` : '–' },
    { label: 'Abstieg', value: s.descent ? `${s.descent.toLocaleString('de-DE')} m` : '–' },
    { label: 'Höhe', value: s.minEle !== null ? `${s.minEle.toLocaleString('de-DE')} – ${s.maxEle!.toLocaleString('de-DE')} m` : '–' },
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
  <TripContextHeader :trip-id="tripId" :title="draft.name || 'Route'" />

  <div v-if="!route" class="text-body-secondary">Route nicht gefunden.</div>
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

    <section class="card mb-3">
      <div class="card-body">
        <div class="mb-2">
          <label for="r-name" class="form-label small">Name</label>
          <input id="r-name" v-model="draft.name" class="form-control" maxlength="120" />
        </div>
        <div class="row g-2 mb-2">
          <div class="col-12 col-md-6">
            <label for="r-day" class="form-label small">Tag der Reise</label>
            <select id="r-day" v-model="draft.date" class="form-select">
              <option value="">– ohne Tag –</option>
              <option v-for="(d, i) in days" :key="d" :value="d">Tag {{ i + 1 }} · {{ formatDayShort(d) }}</option>
              <option v-if="draft.date && !days.includes(draft.date)" :value="draft.date">{{ formatDayShort(draft.date) }}</option>
            </select>
          </div>
          <div class="col-12 col-md-6">
            <span class="form-label small d-block">Farbe</span>
            <div class="d-flex flex-wrap gap-1" role="radiogroup" aria-label="Farbe">
              <button v-for="c in ROUTE_COLORS" :key="c" type="button" class="swatch" :class="{ active: draft.color === c }" :style="{ background: c }"
                      :aria-label="`Farbe ${c}`" :aria-pressed="draft.color === c" @click="draft.color = c"></button>
            </div>
          </div>
        </div>
        <div class="mb-2">
          <label for="r-notes" class="form-label small">Notizen</label>
          <textarea id="r-notes" v-model="draft.notes" rows="3" class="form-control" placeholder="z. B. Parkplatz, Einkehr, Wegbeschaffenheit"></textarea>
        </div>
        <div class="form-check form-switch">
          <input id="r-share" v-model="draft.showInShare" class="form-check-input" type="checkbox" role="switch" />
          <label class="form-check-label" for="r-share">Auf Reise-Webseite und in Lese-Links zeigen</label>
        </div>
        <div class="form-text">Wird automatisch gespeichert.</div>
      </div>
    </section>

    <div class="d-flex flex-wrap gap-2 mb-2">
      <button type="button" class="btn btn-outline-primary" @click="exportGpx"><i class="bi bi-download me-1" aria-hidden="true"></i>Als GPX (für Garmin)</button>
      <button v-if="route.original" type="button" class="btn btn-outline-secondary" @click="downloadOriginal">
        <i class="bi bi-file-earmark me-1" aria-hidden="true"></i>Originaldatei ({{ FORMAT_LABEL[route.format] }})
      </button>
      <button type="button" class="btn btn-outline-danger ms-auto" @click="remove"><i class="bi bi-trash me-1" aria-hidden="true"></i>Löschen</button>
    </div>
    <p class="small text-body-secondary">
      GPX aufs Gerät: <strong>GPSMap</strong> per USB in den Ordner <code>Garmin/GPX</code> kopieren (oder Basecamp);
      <strong>Fenix</strong> über Garmin Connect → Training &amp; Planung → Strecken → „Strecke importieren“ und dann ans Gerät senden.
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
