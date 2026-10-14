<script setup lang="ts">
import { computed, markRaw, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useLiveQuery, useOnline } from '@/core/composables'
import { getMapOverlays, getMapPhotos, placePhoto, type MapOverlay, type MapPhoto } from '@/core/registry'
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
import { groupByPixels } from '../photo-groups'
import { KIND_STYLE, type MapPlace } from '../types'
import { offlineMapRepository, type Bbox, type OfflineMap } from '../offline'
import OfflineMapsCard from './OfflineMapsCard.vue'
import { locale, t } from '@/core/i18n'

const props = defineProps<{ tripId: string }>()
const online = useOnline()

const trip = useLiveQuery(() => tripRepository.get(props.tripId), undefined as Trip | undefined)
const accs = useLiveQuery(() => accommodationRepository.listByTrip(props.tripId), [] as Accommodation[])
const acts = useLiveQuery(() => activityRepository.listByTrip(props.tripId), [] as Activity[])
const places = useLiveQuery(() => placeRepository.listByTrip(props.tripId), [] as MapPlace[])
// Linien anderer Module (z. B. Routen)
const overlays = useLiveQuery(() => getMapOverlays(props.tripId), [] as MapOverlay[], { shallow: true })
// Fotos mit Aufnahmeort (Tagebuch)
const mapPhotos = useLiveQuery(() => getMapPhotos(props.tripId), [] as MapPhoto[], { shallow: true })
const PHOTOS_KEY = 'nww-karte-fotos'
const showPhotos = ref(true)
try {
  showPhotos.value = localStorage.getItem(PHOTOS_KEY) !== 'aus'
} catch {
  /* Standard */
}
watch(showPhotos, (v) => {
  try {
    localStorage.setItem(PHOTOS_KEY, v ? 'an' : 'aus')
  } catch {
    /* egal */
  }
})
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
type PlacedPhoto = MapPhoto & { lat: number; lon: number }
const placedPhotos = computed(() => mapPhotos.value.filter((p): p is PlacedPhoto => p.lat !== null && p.lon !== null))
const unplacedPhotos = computed(() => mapPhotos.value.filter((p) => p.lat === null))
const visiblePhotos = computed(() => (showPhotos.value ? placedPhotos.value.filter((p) => !dayFilter.value || p.date === dayFilter.value) : []))
const plannedDays = computed(() =>
  [...new Set([...acts.value.map((a) => a.plannedDate), ...overlays.value.map((o) => o.date), ...mapPhotos.value.map((p) => p.date)].filter(Boolean))].sort()
)

// ---- Karte ----
const mapEl = ref<HTMLElement>()
let map: L.Map | null = null
let layer: L.LayerGroup | null = null
let photoLayer: L.LayerGroup | null = null
const thumbUrls = new Map<string, string>()
function thumbUrl(p: MapPhoto): string {
  let u = thumbUrls.get(p.id)
  if (!u) {
    u = URL.createObjectURL(p.thumb)
    thumbUrls.set(p.id, u)
  }
  return u
}
let meMarker: L.CircleMarker | null = null
let osm: L.TileLayer | null = null
let offlineLayers: L.Layer[] = []
const me = ref<{ lat: number; lon: number } | null>(null)
let fitted = false

function icon(kind: MapItem['kind'], done: boolean) {
  const s = KIND_STYLE[kind]
  return L.divIcon({
    className: 'nww-pin',
    html: t('<span style="background:{0}"><i class="bi bi-{1}"></i></span>', [done ? '#94a3b8' : s.color, s.icon]),
    iconSize: [30, 30],
    iconAnchor: [15, 28],
    popupAnchor: [0, -26]
  })
}

function popupHtml(l: Located): string {
  const links = navLinks(l.place.lat, l.place.lon, l.title)
  const dist = me.value ? t(' · {0} entfernt', [formatDistance(distanceKm(me.value, l.place))]) : ''
  return t('<strong>{0}</strong><br><small>{1}{2}</small><br>\n    <small class="font-monospace">{3}</small><br>\n    <a href="{4}" target="_blank" rel="noopener">Apple Karten</a> · <a href="{5}" target="_blank" rel="noopener">Google Maps</a>', [escapeHtml(l.title), escapeHtml(l.subtitle), dist, formatGarmin(l.place.lat, l.place.lon), links.apple, links.google])
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
      if (photoTarget.value) return void choosePhotoPlace(lat, lon)
      if (target.value && pickOnMap.value) return void choose(lat, lon, t('auf Route „{0}“', [o.name]))
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

/** Fotos als runde Vorschaubilder; was übereinander läge, wird zu einer Gruppe mit Zahl */
function drawPhotos() {
  if (!map || !photoLayer) return
  photoLayer.clearLayers()
  const m = map
  const groups = groupByPixels(visiblePhotos.value, (lat, lon) => m.latLngToLayerPoint([lat, lon]), 44)
  for (const g of groups) {
    const sorted = [...g].sort((a, b) => a.takenAt.localeCompare(b.takenAt))
    const lat = sorted.reduce((s, p) => s + p.lat, 0) / sorted.length
    const lon = sorted.reduce((s, p) => s + p.lon, 0) / sorted.length
    const icon = L.divIcon({
      className: 'nww-photo',
      html: `<img src="${thumbUrl(sorted[0])}" alt="">${sorted.length > 1 ? `<b>${sorted.length}</b>` : ''}`,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      popupAnchor: [0, -20]
    })
    L.marker([lat, lon], { icon, title: sorted.length > 1 ? t('{0} Fotos', [sorted.length]) : sorted[0].caption || t('Foto'), zIndexOffset: 500 })
      .bindPopup(() => photoPopup(sorted), { maxWidth: 300, minWidth: 200 })
      .addTo(photoLayer)
  }
}

function photoPopup(list: PlacedPhoto[]): HTMLElement {
  const box = document.createElement('div')
  box.className = 'nww-photo-popup'
  const time = (p: MapPhoto) => new Date(p.takenAt).toLocaleString(locale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const shown = list.slice(0, 12)
  box.innerHTML =
    `<div class="grid">${shown
      .map((p, i) => `<a href="#" data-i="${i}" title="${escapeHtml(p.caption || time(p))}"><img src="${thumbUrl(p)}" alt="${escapeHtml(p.caption)}"></a>`)
      .join('')}</div>` +
    (list.length > shown.length ? t('<small>… und {0} weitere</small><br>', [list.length - shown.length]) : '') +
    `<small>${escapeHtml(list.length === 1 ? list[0].caption || time(list[0]) : `${list.length} Fotos · ${time(list[0])} – ${time(list[list.length - 1])}`)}</small>` +
    (list.some((p) => p.source === 'tour') ? t('<br><small class="text-body-secondary"><i class="bi bi-signpost-2"></i> Ort aus der Tour zur Aufnahmezeit geschätzt</small>') : '') +
    (list.length === 1
      ? t('<br><small><a href="#" data-act="move">Ort ändern</a>{0}</small>', [list[0].source === 'karte' ? ' · <a href="#" data-act="clear">Ort entfernen</a>' : ''])
      : '')
  box.addEventListener('click', (ev) => {
    const a = (ev.target as HTMLElement).closest('a')
    if (!a) return
    ev.preventDefault()
    map?.closePopup()
    if (a.dataset.act === 'move') return startPlacePhoto(list[0])
    if (a.dataset.act === 'clear') return void placePhoto(list[0].id, null)
    if (a.dataset.i) router.push(shown[Number(a.dataset.i)].to)
  })
  return box
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
    else choose(lat, lon, t('auf Route „{0}“', [o.name]))
  })
  return box
}

function fitAll() {
  if (!map) return
  const pts = [
    ...visible.value.map((l) => l.place),
    ...visibleOverlays.value.flatMap((o) => o.points.map(([lat, lon]) => ({ lat, lon }))),
    ...visiblePhotos.value.map((p) => ({ lat: p.lat, lon: p.lon }))
  ]
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
      attribution: t('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende')
    })
  )
  layer = markRaw(L.layerGroup().addTo(map))
  photoLayer = markRaw(L.layerGroup().addTo(map))
  map.on('zoomend', drawPhotos)
  map.on('click', (e: L.LeafletMouseEvent) => onMapClick(e.latlng.lat, e.latlng.lng))
  map.on('moveend', updateViewBbox)
  draw()
  drawPhotos()
  updateViewBbox()
  void applyBase()
})

onUnmounted(() => {
  thumbUrls.forEach((u) => URL.revokeObjectURL(u))
  map?.remove()
  map = null
})

watch([visible, me, visibleOverlays], draw, { deep: true })
watch(dayFilter, () => {
  fitted = false
  draw()
})
// Fotos kommen meist nach den Routen an – dann einmal so zoomen, dass auch sie zu sehen sind
let photosFitted = false
watch(visiblePhotos, (list) => {
  drawPhotos()
  if (!fitted || (!photosFitted && list.length)) fitAll()
  if (list.length) photosFitted = true
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
      baseError.value = t('Offline-Karte konnte nicht geladen werden: {0}', [(e as Error).message])
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

const coordResult = (lat: number, lon: number): GeoResult => ({ lat, lon, label: t('Koordinaten {0} · {1}', [formatDecimal(lat, lon), formatGarmin(lat, lon)]) })

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
    if (!results.value.length) searchError.value = t('Nichts gefunden – kürzer suchen (z. B. nur Ort) oder auf der Karte antippen.')
  } catch (e) {
    searchError.value = online.value ? (e as Error).message : t('Für die Suche wird Internet benötigt – oder auf der Karte antippen.')
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
  if (photoTarget.value) return void choosePhotoPlace(lat, lon)
  if (target.value && pickOnMap.value) choose(lat, lon, t('auf der Karte gesetzt'))
}

// ---- Foto von Hand verorten ----
const photoTarget = ref<MapPhoto | null>(null)
function startPlacePhoto(p: MapPhoto) {
  target.value = null
  pickOnMap.value = false
  photoTarget.value = p
  showPhotos.value = true
  mapEl.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}
async function choosePhotoPlace(lat: number, lon: number) {
  const p = photoTarget.value
  photoTarget.value = null
  if (p) await placePhoto(p.id, { lat, lon })
}

function fromRoute(o: MapOverlay, end: boolean) {
  const [lat, lon] = end ? o.points[o.points.length - 1] : o.points[0]
  choose(lat, lon, t('{0} von „{1}“', [end ? 'Ziel' : 'Start', o.name]))
}

const copied = ref('')
async function copyCoords(l: Located) {
  const text = formatDecimal(l.place.lat, l.place.lon, 6)
  try {
    await navigator.clipboard.writeText(text)
    copied.value = t('Kopiert: {0}', [text])
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
  <TripContextHeader :trip-id="tripId" :title="$t('Karte')" />

  <div class="d-flex flex-wrap gap-2 align-items-center mb-2">
    <select v-if="plannedDays.length" v-model="dayFilter" class="form-select form-select-sm w-auto" :aria-label="$t('Tag')">
      <option value="">{{ $t('Alle Tage') }}</option>
      <option v-for="d in plannedDays" :key="d" :value="d">{{ formatDayShort(d) }}</option>
    </select>
    <button type="button" class="btn btn-sm btn-outline-secondary" @click="fitAll"><i class="bi bi-arrows-fullscreen me-1" aria-hidden="true"></i>{{ $t('Alles zeigen') }}</button>
    <button type="button" class="btn btn-sm btn-outline-primary" :disabled="locating" @click="showMe">
      <span v-if="locating" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
      <i v-else class="bi bi-crosshair me-1" aria-hidden="true"></i>{{ $t('Mein Standort') }}
    </button>
    <div v-if="offlineMaps.length" class="btn-group btn-group-sm" role="group" :aria-label="$t('Kartengrundlage')">
      <input id="base-online" v-model="baseMode" type="radio" class="btn-check" value="online" />
      <label class="btn btn-outline-secondary" for="base-online"><i class="bi bi-globe me-1" aria-hidden="true"></i>{{ $t('Online') }}</label>
      <input id="base-offline" v-model="baseMode" type="radio" class="btn-check" value="offline" />
      <label class="btn btn-outline-secondary" for="base-offline"><i class="bi bi-cloud-check me-1" aria-hidden="true"></i>{{ $t('Offline') }}</label>
    </div>
    <span class="small text-body-secondary ms-auto">
      <span class="legend" :style="{ background: KIND_STYLE.accommodation.color }"></span> {{ $t('Unterkunft') }}
      <span class="legend ms-2" :style="{ background: KIND_STYLE.activity.color }"></span> {{ $t('Unternehmung') }}
    </span>
    <button v-if="mapPhotos.length" type="button" class="btn btn-sm" :class="showPhotos ? 'btn-primary' : 'btn-outline-primary'" :aria-pressed="showPhotos" data-photos-toggle @click="showPhotos = !showPhotos">
      <i class="bi bi-images me-1" aria-hidden="true"></i>{{ $t('Fotos ({0})', [mapPhotos.length]) }}
    </button>
  </div>

  <div v-if="target && pickOnMap" class="alert alert-info py-2 small mb-2">
    <i class="bi bi-hand-index me-1" aria-hidden="true"></i>{{ $t('Tippe auf die Karte, wo „{0}“ liegt – oder auf eine Route, dann wird der nächste Punkt der Route genommen.', [target.title]) }}
    <button type="button" class="btn btn-link btn-sm p-0 ms-2" @click="pickOnMap = false">{{ $t('Abbrechen') }}</button>
  </div>

  <div v-if="photoTarget" class="alert alert-info py-2 small mb-2 d-flex align-items-center gap-2" data-photo-target>
    <img :src="thumbUrl(photoTarget)" alt="" class="photo-mini" />
    <span class="flex-grow-1">{{ $t('Tippe auf die Karte, wo das Foto entstanden ist – oder auf eine Route.') }}</span>
    <button type="button" class="btn btn-link btn-sm p-0" @click="photoTarget = null">{{ $t('Abbrechen') }}</button>
  </div>

  <!-- Dynamische Klasse am Rahmen: Vue würde sonst die Klassen überschreiben, die Leaflet am Kartenelement setzt -->
  <div class="map-frame mb-3" :class="{ picking: pickOnMap || !!photoTarget }"><div ref="mapEl" class="map"></div></div>
  <p v-if="baseError" class="small text-danger">{{ baseError }}</p>
  <p v-else-if="!online && !offlineMaps.length" class="small text-body-secondary">
    {{ $t('Offline: Es werden nur Kartenausschnitte angezeigt, die du schon einmal angesehen hast. Tipp: unten „Offline-Karten“ – dann ist die ganze Gegend gespeichert.') }}
  </p>
  <p v-else-if="baseMode === 'offline'" class="small text-body-secondary">{{ $t('Gespeicherte Offline-Karte – außerhalb ihres Ausschnitts bleibt die Karte leer.') }}</p>

  <!-- In der Nähe -->
  <section v-if="nearest.length" class="mb-3">
    <h2 class="h6 text-body-secondary">{{ $t('In deiner Nähe') }}</h2>
    <div class="list-group">
      <button v-for="n in nearest" :key="n.l.refId" type="button" class="list-group-item list-group-item-action d-flex justify-content-between" @click="focus(n.l)">
        <span>{{ n.l.title }}</span><span class="text-body-secondary small">{{ formatDistance(n.km) }}</span>
      </button>
    </div>
  </section>

  <!-- Verorten -->
  <section v-if="target" class="card mb-3 border-primary">
    <div class="card-body">
      <h2 class="h6">{{ $t('„{0}“ auf die Karte setzen', [target.title]) }}</h2>
      <form class="input-group mb-2" @submit.prevent="runSearch">
        <input v-model="query" class="form-control" :aria-label="$t('Adresse, Ort oder GPS-Koordinaten')" :placeholder="$t('Adresse, Ort oder GPS-Koordinaten')" />
        <button class="btn btn-primary" type="submit" :disabled="searching">
          <span v-if="searching" class="spinner-border spinner-border-sm" aria-hidden="true"></span>
          <i v-else class="bi bi-search" aria-hidden="true"></i><span class="visually-hidden">{{ $t('Suchen') }}</span>
        </button>
      </form>
      <div class="form-text mt-0 mb-2">
        {{ $t('Auch GPS-Koordinaten gehen (ohne Internet), z. B.') }} <code>47.0751, 12.7530</code> {{ $t('oder wie am Garmin') }} <code>N 47° 04.507' E 012° 45.180'</code> {{ $t('– oder ein geteilter Link aus Google Maps / Apple Karten.') }}
      </div>
      <div v-if="searchError" class="small text-body-secondary mb-2">{{ searchError }}</div>
      <div class="list-group mb-2">
        <button v-for="r in results" :key="`${r.lat},${r.lon}`" type="button" class="list-group-item list-group-item-action small" @click="choose(r.lat, r.lon, r.label)">
          <i class="bi bi-geo-alt me-1 text-primary" aria-hidden="true"></i>{{ r.label }}
        </button>
      </div>
      <div v-if="overlays.length" class="mb-2">
        <div class="small text-body-secondary mb-1">{{ $t('Von einer Route übernehmen:') }}</div>
        <div v-for="o in overlays" :key="o.id" class="d-flex flex-wrap align-items-center gap-1 mb-1">
          <span class="route-dot" :style="{ background: o.color }"></span>
          <span class="small flex-grow-1 text-truncate">{{ o.name }}</span>
          <button type="button" class="btn btn-sm btn-outline-secondary py-0" :disabled="o.points.length < 2" @click="fromRoute(o, false)">{{ $t('Start') }}</button>
          <button type="button" class="btn btn-sm btn-outline-secondary py-0" :disabled="o.points.length < 2" @click="fromRoute(o, true)">{{ $t('Ziel') }}</button>
        </div>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <button type="button" class="btn btn-sm btn-outline-primary" @click="pickOnMap = true"><i class="bi bi-hand-index me-1" aria-hidden="true"></i>{{ $t('Auf der Karte antippen') }}</button>
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="target = null">{{ $t('Abbrechen') }}</button>
      </div>
      <p class="small text-body-secondary mt-2 mb-0">{{ $t('Adresssuche: Nominatim / © OpenStreetMap-Mitwirkende') }}</p>
    </div>
  </section>

  <!-- Fotos ohne Ort -->
  <section v-if="unplacedPhotos.length" class="mb-3" data-unplaced-photos>
    <h2 class="h6 text-body-secondary">{{ $t('Fotos ohne Ort ({0})', [unplacedPhotos.length]) }}</h2>
    <p class="small text-body-secondary mb-2">
      {{ $t('Diese Fotos haben keine GPS-Angaben, und keine aufgezeichnete Tour passt zur Aufnahmezeit. Antippen und auf der Karte setzen.') }}
    </p>
    <div class="d-flex flex-wrap gap-2">
      <button
        v-for="p in unplacedPhotos.slice(0, 60)"
        :key="p.id"
        type="button"
        class="btn p-0 border-0 photo-pick"
        :class="{ active: photoTarget?.id === p.id }"
        :title="p.caption || formatDayShort(p.date)"
        :aria-label="$t('Foto {0} auf der Karte setzen', [p.caption || formatDayShort(p.date)])"
        @click="startPlacePhoto(p)"
      >
        <img :src="thumbUrl(p)" alt="" />
      </button>
    </div>
  </section>

  <!-- Noch nicht verortet -->
  <section v-if="split.missing.length" class="mb-3">
    <h2 class="h6 text-body-secondary">{{ $t('Noch nicht auf der Karte ({0})', [split.missing.length]) }}</h2>
    <div class="list-group">
      <div v-for="it in split.missing" :key="`${it.kind}-${it.refId}`" class="list-group-item d-flex align-items-center gap-2">
        <i :class="`bi bi-${KIND_STYLE[it.kind].icon}`" :style="{ color: KIND_STYLE[it.kind].color }" aria-hidden="true"></i>
        <div class="flex-grow-1 min-w-0">
          <div class="text-truncate">{{ it.title }}</div>
          <div class="small text-body-secondary text-truncate">{{ it.where || it.subtitle }}</div>
        </div>
        <button type="button" class="btn btn-sm btn-outline-primary flex-none" @click="startLocate(it)">{{ $t('Verorten') }}</button>
      </div>
    </div>
  </section>

  <!-- Auf der Karte -->
  <section v-if="split.located.length" class="mb-3">
    <h2 class="h6 text-body-secondary">{{ $t('Auf der Karte ({0})', [split.located.length]) }}</h2>
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
          <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="dropdown" :aria-label="$t('Aktionen')"><i class="bi bi-three-dots" aria-hidden="true"></i></button>
          <ul class="dropdown-menu dropdown-menu-end">
            <li><a class="dropdown-item" :href="navLinks(l.place.lat, l.place.lon, l.title).apple" target="_blank" rel="noopener">{{ $t('Route in Apple Karten') }}</a></li>
            <li><a class="dropdown-item" :href="navLinks(l.place.lat, l.place.lon, l.title).google" target="_blank" rel="noopener">{{ $t('Route in Google Maps') }}</a></li>
            <li><button class="dropdown-item" @click="copyCoords(l)">{{ $t('Koordinaten kopieren') }}</button></li>
            <li><button class="dropdown-item" @click="startLocate(l)">{{ $t('Neu verorten') }}</button></li>
            <li><button class="dropdown-item text-danger" @click="unlocate(l)">{{ $t('Von der Karte nehmen') }}</button></li>
          </ul>
        </div>
      </div>
    </div>
  </section>

  <OfflineMapsCard :trip-id="tripId" :trip-title="trip?.title ?? ''" :view-bbox="viewBbox" @show="showOfflineMap" />

  <p v-if="items.length === 0" class="text-body-secondary">{{ $t('Lege Unterkünfte oder Unternehmungen an – dann kannst du sie hier auf die Karte setzen.') }}</p>
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
.photo-mini {
  width: 36px;
  height: 36px;
  object-fit: cover;
  border-radius: 50%;
  flex: none;
}
.photo-pick img {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: var(--bs-border-radius);
  display: block;
}
.photo-pick.active img {
  outline: 3px solid var(--bs-primary);
  outline-offset: 2px;
}
:deep(.nww-photo) {
  position: relative;
}
:deep(.nww-photo) img {
  width: 44px;
  height: 44px;
  object-fit: cover;
  border-radius: 50%;
  border: 3px solid #fff;
  box-shadow: 0 1px 5px rgba(0, 0, 0, 0.45);
  background: #ddd;
}
:deep(.nww-photo) b {
  position: absolute;
  top: -6px;
  right: -8px;
  min-width: 22px;
  padding: 0 5px;
  border-radius: 11px;
  background: var(--bs-primary);
  color: #fff;
  font-size: 0.75rem;
  line-height: 20px;
  text-align: center;
  border: 2px solid #fff;
}
:deep(.nww-photo-popup .grid) {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
  margin-bottom: 4px;
}
:deep(.nww-photo-popup img) {
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  border-radius: 4px;
  display: block;
}
:deep(.nww-pin) i {
  transform: rotate(45deg);
  color: #fff;
  font-size: 0.85rem;
}
</style>
