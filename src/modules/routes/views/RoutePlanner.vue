<script setup lang="ts">
import { computed, markRaw, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useLiveQuery, useOnline } from '@/core/composables'
import { parseCoordinates } from '@/services/coordinates'
import { searchAddress, type GeoResult } from '@/services/geocoding'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import { activityRepository, type Activity } from '@/modules/activity/public'
import { accommodationRepository, type Accommodation } from '@/modules/accommodation/public'
import { KIND_STYLE, placeRepository, type MapPlace } from '@/modules/map/public'
import { routeRepository, buildRoute } from '../repository'
import { computeStats, hikingTime, simplifyTo, statsLine } from '../logic'
import { PROFILES, type PlannedRoute } from '../planning/brouter'
import { MAX_SEARCH_SPAN, TRAIL_TYPES, type TrailHit, type TrailType } from '../planning/osm'
import { RoutingApi, fetchElevations } from '../planning/api'
import { formatDuration } from '@/services/tracks'
import type { TrackPoint } from '../types'

const props = defineProps<{ tripId: string }>()
const route = useRoute()
const router = useRouter()
const online = useOnline()

const tab = ref<'planen' | 'wanderwege'>(route.query.tab === 'wanderwege' ? 'wanderwege' : 'planen')
const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const places = useLiveQuery(() => placeRepository.listByTrip(props.tripId), [] as MapPlace[])
const acts = useLiveQuery(() => activityRepository.listByTrip(props.tripId), [] as Activity[])
const accs = useLiveQuery(() => accommodationRepository.listByTrip(props.tripId), [] as Accommodation[])
const api = shallowRef<RoutingApi | null>(null)

/** Verortete Orte der Reise mit Namen – als schnelle Wegpunkte */
const namedPlaces = computed(() => {
  const names = new Map<string, string>([...acts.value.map((a) => [`activity:${a.id}`, a.title] as const), ...accs.value.map((a) => [`accommodation:${a.id}`, a.name] as const)])
  return places.value.filter((p) => names.has(p.id)).map((p) => ({ ...p, name: names.get(p.id)! }))
})

// ───────────── Karte ─────────────
const mapEl = ref<HTMLElement>()
let map: L.Map | null = null
let lineLayer: L.LayerGroup | null = null
let pointLayer: L.LayerGroup | null = null

onMounted(async () => {
  api.value = await RoutingApi.create()
  await nextTick()
  if (!mapEl.value) return
  map = markRaw(L.map(mapEl.value).setView([47.1, 12.8], 9))
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    crossOrigin: true, // mit CORS laden – dann taugen die gemerkten Kacheln auch fürs Kartenbild im Reisebericht
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende'
  }).addTo(map)
  lineLayer = markRaw(L.layerGroup().addTo(map))
  pointLayer = markRaw(L.layerGroup().addTo(map))
  map.on('click', (e: L.LeafletMouseEvent) => {
    if (tab.value === 'planen') addPoint(e.latlng.lat, e.latlng.lng, '')
  })
  fitPlaces()
})
onUnmounted(() => {
  map?.remove()
  map = null
})

function fitPlaces() {
  if (!map || !places.value.length) return
  map.fitBounds(L.latLngBounds(places.value.map((p) => [p.lat, p.lon] as [number, number])), { padding: [40, 40], maxZoom: 13 })
}
watch(() => places.value.length, (n, old) => !old && n && fitPlaces())

function viewBbox(): [number, number, number, number] | null {
  if (!map) return null
  const b = map.getBounds()
  return [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
}

function drawLine(points: [number, number][], color = '#e11d48') {
  lineLayer?.clearLayers()
  if (!lineLayer || points.length < 2) return
  L.polyline(points, { color: '#fff', weight: 8, opacity: 0.8, interactive: false }).addTo(lineLayer)
  L.polyline(points, { color, weight: 5, interactive: false }).addTo(lineLayer)
}

// ───────────── Planen (A → B) ─────────────
interface Waypoint {
  lat: number
  lon: number
  label: string
}
const waypoints = ref<Waypoint[]>([])
const profile = ref<string>('hiking-mountain')
const planned = shallowRef<PlannedRoute | null>(null)
const planning = ref(false)
const planError = ref('')
const query = ref('')
const searchResults = ref<GeoResult[]>([])
const searching = ref(false)

const letter = (i: number, n: number) => (i === 0 ? 'A' : i === n - 1 ? 'B' : String(i))

function drawWaypoints() {
  pointLayer?.clearLayers()
  if (!pointLayer) return
  waypoints.value.forEach((w, i) => {
    const m = L.marker([w.lat, w.lon], {
      draggable: true,
      icon: L.divIcon({ className: 'nww-wp', html: `<span>${letter(i, waypoints.value.length)}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] }),
      title: w.label || `Punkt ${i + 1}`
    })
    m.on('dragend', () => {
      const p = m.getLatLng()
      waypoints.value[i] = { lat: p.lat, lon: p.lng, label: '' }
      waypoints.value = [...waypoints.value]
    })
    m.addTo(pointLayer!)
  })
}

function addPoint(lat: number, lon: number, label: string) {
  if (waypoints.value.length >= 16) return
  waypoints.value = [...waypoints.value, { lat, lon, label }]
}
function removePoint(i: number) {
  waypoints.value = waypoints.value.filter((_, j) => j !== i)
}
function reverse() {
  waypoints.value = [...waypoints.value].reverse()
}
function clearPlan() {
  waypoints.value = []
  planned.value = null
  lineLayer?.clearLayers()
}

let planTimer: ReturnType<typeof setTimeout> | undefined
watch([waypoints, profile], () => {
  drawWaypoints()
  clearTimeout(planTimer)
  planError.value = ''
  if (waypoints.value.length < 2) {
    planned.value = null
    lineLayer?.clearLayers()
    return
  }
  planTimer = setTimeout(runPlan, 400)
}, { deep: true })

async function runPlan() {
  if (!api.value || waypoints.value.length < 2) return
  planning.value = true
  planError.value = ''
  try {
    const r = await api.value.plan(waypoints.value, profile.value)
    planned.value = r
    drawLine(r.points.map((p) => [p[0], p[1]]))
  } catch (e) {
    planError.value = (e as Error).message
  } finally {
    planning.value = false
  }
}

async function runSearch() {
  const c = parseCoordinates(query.value)
  if (c) {
    addPoint(c.lat, c.lon, query.value.trim())
    map?.setView([c.lat, c.lon], Math.max(map.getZoom(), 13))
    query.value = ''
    return
  }
  searching.value = true
  try {
    searchResults.value = await searchAddress(query.value)
  } catch (e) {
    planError.value = (e as Error).message
  } finally {
    searching.value = false
  }
}
function pickResult(r: GeoResult) {
  addPoint(r.lat, r.lon, r.label.split(',')[0])
  map?.setView([r.lat, r.lon], Math.max(map.getZoom(), 13))
  searchResults.value = []
  query.value = ''
}

const plannedTime = computed(() => {
  if (!planned.value) return null
  if (profile.value === 'hiking-mountain' || profile.value === 'shortest') {
    const st = computeStats(planned.value.points)
    return hikingTime(st.distance, st.ascent, st.descent)
  }
  return planned.value.time
})
const plannedStats = computed(() => (planned.value ? computeStats(planned.value.points) : null))
const planName = computed(() => {
  const w = waypoints.value
  if (w.length < 2) return ''
  const a = w[0].label || 'Start'
  const b = w[w.length - 1].label || 'Ziel'
  return `${a} → ${b}`
})

// ───────────── Wanderwege ─────────────
const trailType = ref<TrailType>('hiking')
const trailName = ref('')
const hits = ref<TrailHit[]>([])
const trailBusy = ref(false)
const trailError = ref('')
const selected = shallowRef<{ hit: TrailHit; line: [number, number][] } | null>(null)
const searchedOnce = ref(false)

async function searchTrails() {
  const bbox = viewBbox()
  if (!api.value || !bbox) return
  trailError.value = ''
  if (bbox[2] - bbox[0] > MAX_SEARCH_SPAN || bbox[3] - bbox[1] > MAX_SEARCH_SPAN) {
    trailError.value = 'Der Kartenausschnitt ist zu groß – bitte näher an die Gegend heranzoomen.'
    return
  }
  trailBusy.value = true
  selected.value = null
  lineLayer?.clearLayers()
  try {
    hits.value = await api.value.searchTrails(bbox, trailType.value, trailName.value)
    searchedOnce.value = true
  } catch (e) {
    trailError.value = (e as Error).message
  } finally {
    trailBusy.value = false
  }
}

async function showTrail(hit: TrailHit) {
  if (!api.value) return
  trailBusy.value = true
  trailError.value = ''
  try {
    const line = await api.value.trailLine(hit.id)
    selected.value = { hit, line }
    drawLine(line, '#2563eb')
    map?.fitBounds(L.latLngBounds(line), { padding: [30, 30] })
  } catch (e) {
    trailError.value = (e as Error).message
  } finally {
    trailBusy.value = false
  }
}
const selectedKm = computed(() => (selected.value ? computeStats(selected.value.line.map(([a, b]) => [a, b, null, null] as TrackPoint)).distance : 0))

// ───────────── Speichern ─────────────
const saveName = ref('')
const saveDay = ref('')
const saving = ref(false)
const days = computed(() => {
  const t = trip.value
  if (!t) return []
  const out: string[] = []
  for (let d = new Date(`${t.startDate}T00:00:00Z`); d <= new Date(`${t.endDate}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) out.push(d.toISOString().slice(0, 10))
  return out
})
watch(planName, (n) => tab.value === 'planen' && (saveName.value = n))
watch(selected, (s) => s && (saveName.value = s.hit.ref && !s.hit.name.includes(s.hit.ref) ? `${s.hit.name} (${s.hit.ref})` : s.hit.name))
watch(tab, () => {
  lineLayer?.clearLayers()
  if (tab.value === 'planen' && planned.value) drawLine(planned.value.points.map((p) => [p[0], p[1]]))
  if (tab.value === 'wanderwege' && selected.value) drawLine(selected.value.line, '#2563eb')
  pointLayer?.clearLayers()
  if (tab.value === 'planen') drawWaypoints()
})

async function save() {
  if (!trip.value) return
  saving.value = true
  try {
    let points: TrackPoint[]
    let notes: string
    let format: 'osm' | 'planung'
    if (tab.value === 'planen' && planned.value) {
      points = planned.value.points
      const prof = PROFILES.find((p) => p.id === profile.value)?.label ?? profile.value
      notes = `Geplant mit BRouter (${prof})${plannedTime.value ? ` · Dauer ca. ${formatDuration(plannedTime.value)}` : ''}`
      format = 'planung'
    } else if (selected.value) {
      // Höhen nachladen (OSM kennt keine), damit Profil und Höhenmeter stimmen
      const sampled = simplifyTo(selected.value.line.map(([a, b]) => [a, b, null, null] as TrackPoint), 300)
      const ele = await fetchElevations(sampled.map((p) => [p[0], p[1]]))
      points = sampled.map((p, i) => [p[0], p[1], ele[i], null] as TrackPoint)
      const st = computeStats(points)
      const h = selected.value.hit
      notes = [
        `Aus OpenStreetMap (Relation ${h.id})`,
        h.networkLabel ? `${TRAIL_TYPES[h.type].label.slice(0, -1)} (${h.networkLabel})` : '',
        h.from && h.to ? `${h.from} – ${h.to}` : '',
        h.type === 'hiking' ? `Gehzeit ca. ${formatDuration(hikingTime(st.distance, st.ascent, st.descent))}` : '',
        h.website
      ]
        .filter(Boolean)
        .join(' · ')
      format = 'osm'
    } else return
    const count = await routeRepository.count(props.tripId)
    const r = buildRoute(props.tripId, { name: saveName.value.trim() || 'Route', kind: 'route', points }, { format, filename: '', original: null }, count, trip.value)
    r.notes = notes
    r.date = saveDay.value
    await routeRepository.addMany([r])
    router.push(`/trip/${props.tripId}/routen/${r.id}`)
  } finally {
    saving.value = false
  }
}

const canSave = computed(() => (tab.value === 'planen' ? !!planned.value : !!selected.value))
const placeIcon = (p: MapPlace) => KIND_STYLE[p.kind]
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="t('Strecke planen & Wanderwege')" />

  <ul class="nav nav-tabs mb-2">
    <li class="nav-item">
      <button type="button" class="nav-link" :class="{ active: tab === 'planen' }" @click="tab = 'planen'"><i class="bi bi-signpost-split me-1" aria-hidden="true"></i>{{ t('Von A nach B') }}</button>
    </li>
    <li class="nav-item">
      <button type="button" class="nav-link" :class="{ active: tab === 'wanderwege' }" @click="tab = 'wanderwege'"><i class="bi bi-compass me-1" aria-hidden="true"></i>{{ t('Wanderwege suchen') }}</button>
    </li>
  </ul>

  <div v-if="!online" class="alert alert-warning small py-2">{{ t('Planen und Suchen braucht Internet.') }}</div>

  <div class="row g-3">
    <div class="col-12 col-lg-7">
      <div :class="{ picking: tab === 'planen' }"><div ref="mapEl" class="planner-map"></div></div>
      <p class="small text-body-secondary mt-1 mb-0">
        <template v-if="tab === 'planen'">{{ t('Auf die Karte tippen, um Punkte zu setzen (erst A, dann B, weitere als Zwischenziele). Punkte lassen sich verschieben.') }}</template>
        <template v-else>{{ t('Zur Gegend zoomen, dann „Im Ausschnitt suchen“.') }}</template>
        {{ t('Daten © OpenStreetMap-Mitwirkende') }}<template v-if="tab === 'planen'"> {{ t('· Routenplaner: BRouter') }}</template>.
      </p>
    </div>

    <div class="col-12 col-lg-5">
      <!-- Planen -->
      <template v-if="tab === 'planen'">
        <div class="btn-group btn-group-sm flex-wrap mb-2" role="group" :aria-label="t('Art')">
          <template v-for="p in PROFILES" :key="p.id">
            <input :id="`pr-${p.id}`" v-model="profile" type="radio" class="btn-check" :value="p.id" />
            <label class="btn btn-outline-primary" :for="`pr-${p.id}`"><i :class="`bi bi-${p.icon} me-1`" aria-hidden="true"></i>{{ p.label }}</label>
          </template>
        </div>

        <form class="input-group input-group-sm mb-2" @submit.prevent="runSearch">
          <input v-model="query" class="form-control" :placeholder="t('Ort, Adresse oder GPS-Koordinaten')" :aria-label="t('Punkt suchen')" />
          <button class="btn btn-outline-primary" type="submit" :disabled="!query.trim() || searching">
            <span v-if="searching" class="spinner-border spinner-border-sm" aria-hidden="true"></span><i v-else class="bi bi-plus-lg" aria-hidden="true"></i>
            <span class="visually-hidden">{{ t('Hinzufügen') }}</span>
          </button>
        </form>
        <div v-if="searchResults.length" class="list-group mb-2">
          <button v-for="r in searchResults" :key="`${r.lat},${r.lon}`" type="button" class="list-group-item list-group-item-action small" @click="pickResult(r)">{{ r.label }}</button>
        </div>
        <div v-if="namedPlaces.length" class="mb-2">
          <div class="small text-body-secondary mb-1">{{ t('Orte dieser Reise:') }}</div>
          <div class="d-flex flex-wrap gap-1">
            <button v-for="p in namedPlaces" :key="p.id" type="button" class="btn btn-sm btn-outline-secondary" @click="addPoint(p.lat, p.lon, p.name)">
              <i :class="`bi bi-${placeIcon(p).icon} me-1`" :style="{ color: placeIcon(p).color }" aria-hidden="true"></i>{{ p.name }}
            </button>
          </div>
        </div>

        <ol v-if="waypoints.length" class="list-group list-group-numbered mb-2">
          <li v-for="(w, i) in waypoints" :key="i" class="list-group-item d-flex align-items-center gap-2 py-1 small">
            <span class="flex-grow-1 text-truncate"><strong>{{ letter(i, waypoints.length) }}</strong> · {{ w.label || `${w.lat.toFixed(4)}, ${w.lon.toFixed(4)}` }}</span>
            <button type="button" class="btn btn-sm btn-link text-danger p-0" :aria-label="`Punkt ${i + 1} entfernen`" @click="removePoint(i)"><i class="bi bi-x-lg" aria-hidden="true"></i></button>
          </li>
        </ol>
        <div class="d-flex gap-2 mb-2">
          <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="waypoints.length < 2" @click="reverse"><i class="bi bi-arrow-left-right me-1" aria-hidden="true"></i>{{ t('Umkehren') }}</button>
          <button type="button" class="btn btn-sm btn-outline-secondary" :disabled="!waypoints.length" @click="clearPlan">{{ t('Leeren') }}</button>
        </div>

        <div v-if="planning" class="small"><span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>{{ t('Berechne Strecke …') }}</div>
        <div v-if="planError" class="alert alert-danger small py-2">{{ planError }}</div>
        <div v-if="planned && plannedStats && !planning" class="card mb-2">
          <div class="card-body py-2">
            <div class="fw-semibold">{{ statsLine({ ...plannedStats, duration: null }) }}</div>
            <div v-if="plannedTime" class="small text-body-secondary">{{ profile === 'hiking-mountain' ? t('Dauer ca. {duration} (Gehzeit nach DIN 33466, ohne Pausen)', { duration: formatDuration(plannedTime) }) : t('Dauer ca. {duration}', { duration: formatDuration(plannedTime) }) }}</div>
          </div>
        </div>
      </template>

      <!-- Wanderwege -->
      <template v-else>
        <div class="btn-group btn-group-sm mb-2" role="group" :aria-label="t('Art')">
          <template v-for="(tt, key) in TRAIL_TYPES" :key="key">
            <input :id="`tt-${key}`" v-model="trailType" type="radio" class="btn-check" :value="key" />
            <label class="btn btn-outline-primary" :for="`tt-${key}`"><i :class="`bi bi-${tt.icon} me-1`" aria-hidden="true"></i>{{ tt.label }}</label>
          </template>
        </div>
        <form class="input-group input-group-sm mb-2" @submit.prevent="searchTrails">
          <input v-model="trailName" class="form-control" :placeholder="t('Name (optional), z. B. Glockner')" :aria-label="t('Name')" />
          <button class="btn btn-primary" type="submit" :disabled="trailBusy">
            <span v-if="trailBusy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>{{ t('Im Ausschnitt suchen') }}
          </button>
        </form>
        <div v-if="trailError" class="alert alert-danger small py-2">{{ trailError }}</div>
        <div v-if="searchedOnce && !hits.length && !trailBusy" class="small text-body-secondary mb-2">{{ t('Nichts gefunden – Ausschnitt verschieben oder ohne Namen suchen.') }}</div>
        <div class="list-group trail-list mb-2">
          <button v-for="h in hits" :key="h.id" type="button" class="list-group-item list-group-item-action" :class="{ active: selected?.hit.id === h.id }" @click="showTrail(h)">
            <div class="d-flex justify-content-between gap-2">
              <span class="fw-semibold text-truncate">{{ h.name }}</span>
              <span v-if="h.ref" class="badge text-bg-light border flex-none">{{ h.ref }}</span>
            </div>
            <div class="small opacity-75 text-truncate">
              {{ [h.networkLabel, h.from && h.to ? `${h.from} – ${h.to}` : '', h.distance ? `${h.distance} km` : ''].filter(Boolean).join(' · ') || 'ausgeschilderte Route' }}
            </div>
          </button>
        </div>
        <div v-if="selected" class="small text-body-secondary mb-2">{{ t('„{name}“ · ca. {x} km – Höhen werden beim Übernehmen ergänzt.', { name: selected.hit.name, x: (selectedKm / 1000).toLocaleString(intlLocale(), { maximumFractionDigits: 1 }) }) }}</div>
      </template>

      <!-- Speichern -->
      <div v-if="canSave" class="card border-primary">
        <div class="card-body">
          <h2 class="h6">{{ t('Als Route speichern') }}</h2>
          <div class="mb-2">
            <label for="rp-name" class="form-label small mb-1">{{ t('Name') }}</label>
            <input id="rp-name" v-model="saveName" class="form-control form-control-sm" maxlength="120" />
          </div>
          <div class="mb-2">
            <label for="rp-day" class="form-label small mb-1">{{ t('Tag') }}</label>
            <select id="rp-day" v-model="saveDay" class="form-select form-select-sm">
              <option value="">{{ t('ohne Tag') }}</option>
              <option v-for="d in days" :key="d" :value="d">{{ new Date(`${d}T00:00:00Z`).toLocaleDateString(intlLocale(), { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' }) }}</option>
            </select>
          </div>
          <button type="button" class="btn btn-primary btn-sm" :disabled="saving" @click="save">
            <span v-if="saving" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span><i v-else class="bi bi-save me-1" aria-hidden="true"></i>{{ t('Speichern') }}
          </button>
          <p class="small text-body-secondary mt-2 mb-0">{{ t('Danach: auf der Karte der Reise, im Tagebuch und als GPX für Garmin exportierbar.') }}</p>
        </div>
      </div>
      <p v-if="api && !api.viaServer" class="small text-body-secondary mt-2">{{ t('Tipp: Mit eingerichtetem Geräte-Abgleich laufen Suche und Planung über deinen Server – zuverlässiger.') }}</p>
    </div>
  </div>
</template>

<style scoped>
.planner-map {
  height: 60vh;
  min-height: 340px;
  border-radius: var(--bs-border-radius-lg);
  border: 1px solid var(--bs-border-color);
  z-index: 0;
}
.picking .planner-map {
  cursor: crosshair;
}
.trail-list {
  max-height: 40vh;
  overflow-y: auto;
}
.flex-none {
  flex: none;
}
:deep(.nww-wp) span {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #e11d48;
  color: #fff;
  font-weight: 700;
  font-size: 0.8rem;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}
</style>
