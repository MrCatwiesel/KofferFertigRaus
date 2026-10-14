<script setup lang="ts">
import { computed, markRaw, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useLiveQuery, useOnline } from '@/core/composables'
import { getMapOverlays, type MapOverlay } from '@/core/registry'
import { useRouter } from 'vue-router'
import { formatDayShort } from '@/core/format'
import { distanceKm, formatDistance, searchAddress, type GeoResult } from '@/services/geocoding'
import { formatDecimal, formatGarmin, parseCoordinates } from '@/services/coordinates'
import { escapeHtml } from '@/core/html'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import { ACCOMMODATION_TYPE_LABELS, accommodationRepository, type Accommodation } from '@/modules/accommodation/public'
import { SETTING, activityRepository, type Activity } from '@/modules/activity/public'
import { placeRepository } from '../repository'
import { boundsOf, buildQuery, navLinks, nearestOnRoute, splitByLocation, type Located, type MapItem } from '../logic'
import { KIND_STYLE, type MapPlace } from '../types'
import { offlineMapRepository, type Bbox, type OfflineMap } from '../offline'
import OfflineMapsCard from './OfflineMapsCard.vue'

const props = defineProps<{ tripId: string }>()
const online = useOnline()

const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const accs = useLiveQuery(() => accommodationRepository.listByTrip(props.tripId), [] as Accommodation[])
const acts = useLiveQuery(() => activityRepository.listByTrip(props.tripId), [] as Activity[])
const places = useLiveQuery(() => placeRepository.listByTrip(props.tripId), [] as MapPlace[])
// Linien anderer Module (z. B. Routen)
const overlays = useLiveQuery(() => getMapOverlays(props.tripId), [] as MapOverlay[], { shallow: true })
const router = useRouter()

const dayFilter = ref('')

const items = computed<MapItem[]>(() => [
  ...accs.value
    .filter((a) => a.status !== 'storniert')
    .map((a) => ({
      kind: 'accommodation' as const,
      refId: a.id,
      title: a.name,
      subtitle: `${ACCOMMODATION_TYPE_LABELS[a.type]} · ${formatDayShort(a.checkIn)} – ${formatDayShort(a.checkOut)}`,
      where: a.address,
      date: '',
      done: false
    })),
  ...acts.value
    .filter((a) => a.status !== 'verworfen')
    .map((a) => ({
      kind: 'activity' as const,
      refId: a.id,
      title: a.title,
      subtitle: [SETTING[a.setting].label, a.plannedDate ? formatDayShort(a.plannedDate) : ''].filter(Boolean).join(' · '),
      where: a.place,
      date: a.plannedDate,
      done: a.status === 'erledigt'
    }))
])

const split = computed(() => splitByLocation(items.value, places.value))
const visible = computed(() =>
  split.value.located.filter((l) => !dayFilter.value || l.kind === 'accommodation' || l.date === dayFilter.value)
)
const visibleOverlays = computed(() => overlays.value.filter((o) => !dayFilter.value || o.date === dayFilter.value))
const plannedDays = computed(() => [...new Set([...acts.value.map((a) => a.plannedDate), ...overlays.value.map((o) => o.date)].filter(Boolean))].sort())

// ---- Karte ----
const mapEl = ref<HTMLElement>()
let map: L.Map | null = null
let layer: L.LayerGroup | null = null
let meMarker: L.CircleMarker | null = null
let osm: L.TileLayer | null = null
let offlineLayers: L.Layer[] = []
const me = ref<{ lat: number; lon: number } | null>(null)
let fitted = false

function icon(kind: MapItem['kind'], done: boolean) {
  const s = KIND_STYLE[kind]
  return L.divIcon({
    className: 'nww-pin',
    html: `<span style="background:${done ? '#94a3b8' : s.color}"><i class="bi bi-${s.icon}"></i></span>`,
    iconSize: [30, 30],
    iconAnchor: [15, 28],
    popupAnchor: [0, -26]
  })
}

function popupHtml(l: Located): string {
  const links = navLinks(l.place.lat, l.place.lon, l.title)
  const dist = me.value ? ` · ${formatDistance(distanceKm(me.value, l.place))} entfernt` : ''
  return `<strong>${escapeHtml(l.title)}</strong><br><small>${escapeHtml(l.subtitle)}${dist}</small><br>
    <small class="font-monospace">${formatGarmin(l.place.lat, l.place.lon)}</small><br>
    <a href="${links.apple}" target="_blank" rel="noopener">Apple Karten</a> · <a href="${links.google}" target="_blank" rel="noopener">Google Maps</a>`
}

function draw() {
  if (!map || !layer) return
  layer.clearLayers()
  for (const o of visibleOverlays.value) {
    if (o.points.length < 2) continue
    L.polyline(o.points, { color: '#fff', weight: 7, opacity: 0.8, interactive: false }).addTo(layer)
    L.polyline(o.points, { color: o.color, weight: 4, interactive: false }).addTo(layer)
    // Breite, unsichtbare Linie zum Antippen – mit dem Finger ist die dünne Linie kaum zu treffen
    const hit = L.polyline(o.points, { color: o.color, weight: 22, opacity: 0, className: 'nww-route-hit' }).addTo(layer)
    hit.on('click', (e: L.LeafletMouseEvent) => {
      L.DomEvent.stop(e)
      const [lat, lon] = nearestOnRoute(o.points, e.latlng.lat, e.latlng.lng)
      if (target.value && pickOnMap.value) return void choose(lat, lon, `auf Route „${o.name}“`)
      L.popup().setLatLng([lat, lon]).setContent(routePopup(o, lat, lon)).openOn(map!)
    })
  }
  for (const l of visible.value) {
    L.marker([l.place.lat, l.place.lon], { icon: icon(l.kind, l.done), title: l.title })
      .bindPopup(popupHtml(l))
      .addTo(layer)
  }
  if (!fitted) fitAll()
}

function routePopup(o: MapOverlay, lat: number, lon: number): HTMLElement {
  const box = document.createElement('div')
  box.innerHTML = `<strong>${escapeHtml(o.name)}</strong><br><small>${escapeHtml(o.info)}</small><br>
    <small class="font-monospace">${formatGarmin(lat, lon)}</small><br>
    <a href="#" data-act="details">Details</a>${target.value ? ` · <a href="#" data-act="here">„${escapeHtml(target.value.title)}“ hier setzen</a>` : ''}`
  box.addEventListener('click', (ev) => {
    const act = (ev.target as HTMLElement).closest('a')?.dataset.act
    if (!act) return
    ev.preventDefault()
    map?.closePopup()
    if (act === 'details') router.push(o.to)
    else choose(lat, lon, `auf Route „${o.name}“`)
  })
  return box
}

function fitAll() {
  if (!map) return
  const pts = [...visible.value.map((l) => l.place), ...visibleOverlays.value.flatMap((o) => o.points.map(([lat, lon]) => ({ lat, lon })))]
  const b = boundsOf(pts)
  if (b) {
    map.fitBounds(b, { padding: [40, 40], maxZoom: 15 })
    fitted = true
  }
}

onMounted(async () => {
  await nextTick()
  if (!mapEl.value) return
  map = markRaw(L.map(mapEl.value, { zoomControl: true }).setView([48.1, 11.6], 5))
  osm = markRaw(
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      crossOrigin: true, // mit CORS laden – dann taugen die gemerkten Kacheln auch fürs Kartenbild im Reisebericht
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende'
    })
  )
  layer = markRaw(L.layerGroup().addTo(map))
  map.on('click', (e: L.LeafletMouseEvent) => onMapClick(e.latlng.lat, e.latlng.lng))
  map.on('moveend', updateViewBbox)
  draw()
  updateViewBbox()
  void applyBase()
})

onUnmounted(() => {
  map?.remove()
  map = null
})

watch([visible, me, visibleOverlays], draw, { deep: true })
watch(dayFilter, () => {
  fitted = false
  draw()
})

// ---- Kartengrundlage: online (OpenStreetMap) oder gespeicherte Offline-Karte ----
const offlineMaps = useLiveQuery(() => offlineMapRepository.listByTrip(props.tripId), [] as OfflineMap[])
const baseMode = ref<'online' | 'offline'>('online')
const viewBbox = ref<Bbox | null>(null)
const baseError = ref('')
let baseToken = 0

function updateViewBbox() {
  if (!map) return
  const b = map.getBounds()
  viewBbox.value = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
}

async function applyBase() {
  if (!map) return
  const token = ++baseToken
  baseError.value = ''
  for (const l of offlineLayers) l.remove()
  offlineLayers = []
  if (baseMode.value === 'offline' && offlineMaps.value.length) {
    try {
      const { createOfflineLayers } = await import('../offline-layer')
      const dark = document.documentElement.getAttribute('data-bs-theme') === 'dark'
      const layers = await createOfflineLayers(offlineMaps.value, dark)
      if (token !== baseToken || !map) return
      osm?.remove()
      offlineLayers = layers.map((l) => markRaw(l).addTo(map!))
      return
    } catch (e) {
      baseError.value = `Offline-Karte konnte nicht geladen werden: ${(e as Error).message}`
    }
  }
  if (osm && map && !map.hasLayer(osm)) osm.addTo(map)
}

// Ohne Internet automatisch die gespeicherte Karte nehmen (falls vorhanden)
const offlineKey = computed(() => offlineMaps.value.map((m) => m.id).join(','))
watch(
  [online, offlineKey],
  ([on], [wasOn, oldKey]) => {
    if (!offlineMaps.value.length) baseMode.value = 'online'
    else if (!on && (wasOn !== on || !oldKey)) baseMode.value = 'offline'
  },
  { immediate: true }
)
watch([baseMode, offlineKey], () => void applyBase())

function showOfflineMap(bbox: Bbox) {
  baseMode.value = 'offline'
  map?.fitBounds(L.latLngBounds([bbox[1], bbox[0]], [bbox[3], bbox[2]]))
  mapEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// ---- Verorten ----
const target = ref<MapItem | null>(null)
const query = ref('')
const results = ref<GeoResult[]>([])
const searching = ref(false)
const searchError = ref('')
const pickOnMap = ref(false)

function startLocate(it: MapItem) {
  target.value = it
  query.value = buildQuery(it.where, it.title, trip.value?.destination ?? '')
  results.value = []
  searchError.value = ''
  pickOnMap.value = false
  // Steht im Ort schon eine Koordinate (oder ein Karten-Link)? Dann gleich anbieten.
  const c = parseCoordinates(it.where)
  if (c) results.value = [coordResult(c.lat, c.lon)]
}

const coordResult = (lat: number, lon: number): GeoResult => ({ lat, lon, label: `Koordinaten ${formatDecimal(lat, lon)} · ${formatGarmin(lat, lon)}` })

async function runSearch() {
  searchError.value = ''
  // GPS-Koordinaten oder Karten-Links brauchen kein Internet
  const c = parseCoordinates(query.value)
  if (c) {
    results.value = [coordResult(c.lat, c.lon)]
    return
  }
  searching.value = true
  try {
    results.value = await searchAddress(query.value)
    if (!results.value.length) searchError.value = 'Nichts gefunden – kürzer suchen (z. B. nur Ort) oder auf der Karte antippen.'
  } catch (e) {
    searchError.value = online.value ? (e as Error).message : 'Für die Suche wird Internet benötigt – oder auf der Karte antippen.'
  } finally {
    searching.value = false
  }
}

async function choose(lat: number, lon: number, label: string) {
  if (!target.value) return
  await placeRepository.set(props.tripId, target.value.kind, target.value.refId, lat, lon, label)
  map?.setView([lat, lon], Math.max(map.getZoom(), 14))
  target.value = null
  pickOnMap.value = false
}

function onMapClick(lat: number, lon: number) {
  if (target.value && pickOnMap.value) choose(lat, lon, 'auf der Karte gesetzt')
}

function fromRoute(o: MapOverlay, end: boolean) {
  const [lat, lon] = end ? o.points[o.points.length - 1] : o.points[0]
  choose(lat, lon, `${end ? 'Ziel' : 'Start'} von „${o.name}“`)
}

const copied = ref('')
async function copyCoords(l: Located) {
  const text = formatDecimal(l.place.lat, l.place.lon, 6)
  try {
    await navigator.clipboard.writeText(text)
    copied.value = `Kopiert: ${text}`
  } catch {
    copied.value = text
  }
  setTimeout(() => (copied.value = ''), 4000)
}

async function unlocate(l: Located) {
  await placeRepository.remove(l.kind, l.refId)
}

function focus(l: Located) {
  map?.setView([l.place.lat, l.place.lon], 16)
  layer?.eachLayer((m) => {
    const mk = m as L.Marker
    const p = mk.getLatLng?.()
    if (p && p.lat === l.place.lat && p.lng === l.place.lon) mk.openPopup()
  })
  mapEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

// ---- Mein Standort ----
const locating = ref(false)
function showMe() {
  if (!navigator.geolocation) return
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locating.value = false
      me.value = { lat: pos.coords.latitude, lon: pos.coords.longitude }
      if (!map) return
      meMarker?.remove()
      meMarker = markRaw(
        L.circleMarker([me.value.lat, me.value.lon], { radius: 8, color: '#fff', weight: 3, fillColor: '#0d6efd', fillOpacity: 1 }).addTo(map)
      )
      map.setView([me.value.lat, me.value.lon], 14)
    },
    () => (locating.value = false),
    { enableHighAccuracy: true, timeout: 10000 }
  )
}

const nearest = computed(() => {
  if (!me.value) return []
  return split.value.located
    .filter((l) => l.kind === 'activity' && !l.done)
    .map((l) => ({ l, km: distanceKm(me.value!, l.place) }))
    .sort((a, b) => a.km - b.km)
    .slice(0, 3)
})
</script>

<template>
  <TripContextHeader :trip-id="tripId" title="Karte" />

  <div class="d-flex flex-wrap gap-2 align-items-center mb-2">
    <select v-if="plannedDays.length" v-model="dayFilter" class="form-select form-select-sm w-auto" aria-label="Tag">
      <option value="">Alle Tage</option>
      <option v-for="d in plannedDays" :key="d" :value="d">{{ formatDayShort(d) }}</option>
    </select>
    <button type="button" class="btn btn-sm btn-outline-secondary" @click="fitAll"><i class="bi bi-arrows-fullscreen me-1" aria-hidden="true"></i>Alles zeigen</button>
    <button type="button" class="btn btn-sm btn-outline-primary" :disabled="locating" @click="showMe">
      <span v-if="locating" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
      <i v-else class="bi bi-crosshair me-1" aria-hidden="true"></i>Mein Standort
    </button>
    <div v-if="offlineMaps.length" class="btn-group btn-group-sm" role="group" aria-label="Kartengrundlage">
      <input id="base-online" v-model="baseMode" type="radio" class="btn-check" value="online" />
      <label class="btn btn-outline-secondary" for="base-online"><i class="bi bi-globe me-1" aria-hidden="true"></i>Online</label>
      <input id="base-offline" v-model="baseMode" type="radio" class="btn-check" value="offline" />
      <label class="btn btn-outline-secondary" for="base-offline"><i class="bi bi-cloud-check me-1" aria-hidden="true"></i>Offline</label>
    </div>
    <span class="small text-body-secondary ms-auto">
      <span class="legend" :style="{ background: KIND_STYLE.accommodation.color }"></span> Unterkunft
      <span class="legend ms-2" :style="{ background: KIND_STYLE.activity.color }"></span> Unternehmung
    </span>
  </div>

  <div v-if="target && pickOnMap" class="alert alert-info py-2 small mb-2">
    <i class="bi bi-hand-index me-1" aria-hidden="true"></i>Tippe auf die Karte, wo „{{ target.title }}“ liegt – oder auf eine Route, dann wird der nächste Punkt der Route genommen.
    <button type="button" class="btn btn-link btn-sm p-0 ms-2" @click="pickOnMap = false">Abbrechen</button>
  </div>

  <!-- Dynamische Klasse am Rahmen: Vue würde sonst die Klassen überschreiben, die Leaflet am Kartenelement setzt -->
  <div class="map-frame mb-3" :class="{ picking: pickOnMap }"><div ref="mapEl" class="map"></div></div>
  <p v-if="baseError" class="small text-danger">{{ baseError }}</p>
  <p v-else-if="!online && !offlineMaps.length" class="small text-body-secondary">
    Offline: Es werden nur Kartenausschnitte angezeigt, die du schon einmal angesehen hast. Tipp: unten „Offline-Karten“ – dann ist die ganze Gegend gespeichert.
  </p>
  <p v-else-if="baseMode === 'offline'" class="small text-body-secondary">Gespeicherte Offline-Karte – außerhalb ihres Ausschnitts bleibt die Karte leer.</p>

  <!-- In der Nähe -->
  <section v-if="nearest.length" class="mb-3">
    <h2 class="h6 text-body-secondary">In deiner Nähe</h2>
    <div class="list-group">
      <button v-for="n in nearest" :key="n.l.refId" type="button" class="list-group-item list-group-item-action d-flex justify-content-between" @click="focus(n.l)">
        <span>{{ n.l.title }}</span><span class="text-body-secondary small">{{ formatDistance(n.km) }}</span>
      </button>
    </div>
  </section>

  <!-- Verorten -->
  <section v-if="target" class="card mb-3 border-primary">
    <div class="card-body">
      <h2 class="h6">„{{ target.title }}“ auf die Karte setzen</h2>
      <form class="input-group mb-2" @submit.prevent="runSearch">
        <input v-model="query" class="form-control" aria-label="Adresse, Ort oder GPS-Koordinaten" placeholder="Adresse, Ort oder GPS-Koordinaten" />
        <button class="btn btn-primary" type="submit" :disabled="searching">
          <span v-if="searching" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
          <i v-else class="bi bi-search" aria-hidden="true"></i><span class="visually-hidden">Suchen</span>
        </button>
      </form>
      <div class="form-text mt-0 mb-2">
        Auch GPS-Koordinaten gehen (ohne Internet), z. B. <code>47.0751, 12.7530</code> oder wie am Garmin <code>N 47° 04.507' E 012° 45.180'</code> –
        oder ein geteilter Link aus Google Maps / Apple Karten.
      </div>
      <div v-if="searchError" class="small text-body-secondary mb-2">{{ searchError }}</div>
      <div class="list-group mb-2">
        <button v-for="r in results" :key="`${r.lat},${r.lon}`" type="button" class="list-group-item list-group-item-action small" @click="choose(r.lat, r.lon, r.label)">
          <i class="bi bi-geo-alt me-1 text-primary" aria-hidden="true"></i>{{ r.label }}
        </button>
      </div>
      <div v-if="overlays.length" class="mb-2">
        <div class="small text-body-secondary mb-1">Von einer Route übernehmen:</div>
        <div v-for="o in overlays" :key="o.id" class="d-flex flex-wrap align-items-center gap-1 mb-1">
          <span class="route-dot" :style="{ background: o.color }"></span>
          <span class="small flex-grow-1 text-truncate">{{ o.name }}</span>
          <button type="button" class="btn btn-sm btn-outline-secondary py-0" :disabled="o.points.length < 2" @click="fromRoute(o, false)">Start</button>
          <button type="button" class="btn btn-sm btn-outline-secondary py-0" :disabled="o.points.length < 2" @click="fromRoute(o, true)">Ziel</button>
        </div>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <button type="button" class="btn btn-sm btn-outline-primary" @click="pickOnMap = true"><i class="bi bi-hand-index me-1" aria-hidden="true"></i>Auf der Karte antippen</button>
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="target = null">Abbrechen</button>
      </div>
      <p class="small text-body-secondary mt-2 mb-0">Adresssuche: Nominatim / © OpenStreetMap-Mitwirkende</p>
    </div>
  </section>

  <!-- Noch nicht verortet -->
  <section v-if="split.missing.length" class="mb-3">
    <h2 class="h6 text-body-secondary">Noch nicht auf der Karte ({{ split.missing.length }})</h2>
    <div class="list-group">
      <div v-for="it in split.missing" :key="`${it.kind}-${it.refId}`" class="list-group-item d-flex align-items-center gap-2">
        <i :class="`bi bi-${KIND_STYLE[it.kind].icon}`" :style="{ color: KIND_STYLE[it.kind].color }" aria-hidden="true"></i>
        <div class="flex-grow-1 min-w-0">
          <div class="text-truncate">{{ it.title }}</div>
          <div class="small text-body-secondary text-truncate">{{ it.where || it.subtitle }}</div>
        </div>
        <button type="button" class="btn btn-sm btn-outline-primary flex-none" @click="startLocate(it)">Verorten</button>
      </div>
    </div>
  </section>

  <!-- Auf der Karte -->
  <section v-if="split.located.length" class="mb-3">
    <h2 class="h6 text-body-secondary">Auf der Karte ({{ split.located.length }})</h2>
    <div v-if="copied" class="alert alert-success py-1 small mb-2" role="status">{{ copied }}</div>
    <div class="list-group">
      <div v-for="l in split.located" :key="l.place.id" class="list-group-item d-flex align-items-center gap-2">
        <i :class="`bi bi-${KIND_STYLE[l.kind].icon}`" :style="{ color: KIND_STYLE[l.kind].color }" aria-hidden="true"></i>
        <button type="button" class="btn btn-link text-body text-decoration-none text-start p-0 flex-grow-1 min-w-0" @click="focus(l)">
          <div class="text-truncate">{{ l.title }}</div>
          <div class="small text-body-secondary text-truncate">{{ l.subtitle }}</div>
          <div class="small text-body-secondary font-monospace text-truncate">{{ formatGarmin(l.place.lat, l.place.lon) }}</div>
        </button>
        <div class="dropdown flex-none">
          <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="dropdown" aria-label="Aktionen"><i class="bi bi-three-dots" aria-hidden="true"></i></button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><a class="dropdown-item" :href="navLinks(l.place.lat, l.place.lon, l.title).apple" target="_blank" rel="noopener">Route in Apple Karten</a></li>
            <li><a class="dropdown-item" :href="navLinks(l.place.lat, l.place.lon, l.title).google" target="_blank" rel="noopener">Route in Google Maps</a></li>
            <li><button class="dropdown-item" @click="copyCoords(l)">Koordinaten kopieren</button></li>
            <li><button class="dropdown-item" @click="startLocate(l)">Neu verorten</button></li>
            <li><button class="dropdown-item text-danger" @click="unlocate(l)">Von der Karte nehmen</button></li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <OfflineMapsCard :trip-id="tripId" :trip-title="trip?.title ?? ''" :view-bbox="viewBbox" @show="showOfflineMap" />

  <p v-if="items.length === 0" class="text-body-secondary">Lege Unterkünfte oder Unternehmungen an – dann kannst du sie hier auf die Karte setzen.</p>
</template>

<style scoped>
.map {
  height: 55vh;
  min-height: 320px;
  border-radius: var(--bs-border-radius-lg);
  border: 1px solid var(--bs-border-color);
  z-index: 0;
}
.map-frame.picking .map {
  cursor: crosshair;
  outline: 3px solid var(--bs-primary);
}
.legend {
  display: inline-block;
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  vertical-align: middle;
}
.route-dot {
  display: inline-block;
  width: 0.9rem;
  height: 0.3rem;
  border-radius: 2px;
  flex: none;
}
.map-frame.picking :deep(.nww-route-hit) {
  cursor: copy;
}
.flex-none {
  flex: none;
}
.min-w-0 {
  min-width: 0;
}
:deep(.nww-pin) span {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50% 50% 50% 0;
  transform: rotate(-45deg);
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}
:deep(.nww-pin) i {
  transform: rotate(45deg);
  color: #fff;
  font-size: 0.85rem;
}
</style>
