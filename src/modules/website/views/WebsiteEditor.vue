<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, shallowRef, watch } from 'vue'
import { useRouter } from 'vue-router'
import bootstrapCssRaw from 'bootstrap/dist/css/bootstrap.min.css?raw'
import { useLiveQuery } from '@/core/composables'
import { formatBytes } from '@/core/storage'
import DonationHint from '@/ui/DonationHint.vue'
import { blobToDataUrl, resizeBlob } from '@/services/images'
import { renderStaticMap } from '@/services/static-map'
import { useOnline } from '@/core/composables'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import { journalRepository, orderPhotos, photoRepository, useObjectUrls, type JournalEntry, type Photo } from '@/modules/journal/public'
import { routeRepository, type Route } from '@/modules/routes/public'
import { accommodationRepository, type Accommodation } from '@/modules/accommodation/public'
import { activityRepository, type Activity } from '@/modules/activity/public'
import { chooseActivities, chooseStays, type ActivityInput, type StayInput } from '../sections'
import { websiteRepository } from '../repository'
import { buildSiteData, defaultSettings, fileNameFor, type EntryInput, type ExtraInput, type RouteInput } from '../logic'
import { renderSite } from '../render'
import { embeddedFontCss, fontFaceCss } from '../fonts'
import { ACCENT_PRESETS, FONT_GROUPS, IMAGE_EDGE, TEMPLATE_INFO, type SitePhoto, type WebsiteSettingsDraft } from '../types'

const props = defineProps<{ tripId: string }>()
const router = useRouter()

/** Bootstrap ohne Verweis auf die Quelltext-Karte (die es in der Datei nicht gibt) */
const bootstrapCss = bootstrapCssRaw.replace(/\/\*# sourceMappingURL=.*?\*\//g, '')

const trip = ref<Trip>()
const entries = useLiveQuery(() => journalRepository.listByTrip(props.tripId), [] as JournalEntry[])
const photos = useLiveQuery(() => photoRepository.listByTrip(props.tripId), [] as Photo[])
const routes = useLiveQuery(() => routeRepository.listByTrip(props.tripId), [] as Route[])
// Nur Routen, die für Webseite/Lese-Links freigegeben sind
const shared = computed(() => routes.value.filter((r) => r.showInShare))
const hiddenRoutes = computed(() => routes.value.filter((r) => !r.showInShare))

// Kartenbilder (OpenStreetMap-Hintergrund mit Strecke) – einmal erzeugt, dann für Vorschau und Datei verwendet
const ROUTE_MAP = { width: 1000, height: 560 }
const OVERVIEW_MAP = { width: 1200, height: 700 }
const online = useOnline()
const mapBlobs = shallowRef(new Map<string, Blob>())
const mapUrls = shallowRef(new Map<string, string>())
const mapState = ref<'' | 'laden' | 'fertig' | 'fehlt'>('')
const mapKey = (r: Route) => `${r.id}|${r.color}|${r.updatedAt}`
const overviewKey = computed(() => (shared.value.length > 1 ? `overview|${shared.value.map(mapKey).join(',')}` : ''))
let mapRun = 0

async function loadMaps() {
  const run = ++mapRun
  const jobs: [string, () => Promise<Blob | null>][] = []
  for (const r of shared.value) {
    const k = mapKey(r)
    if (!mapBlobs.value.has(k) && r.preview.length > 1) jobs.push([k, () => renderStaticMap([{ points: r.preview, color: r.color }], { ...ROUTE_MAP, stroke: 5, markers: true })])
  }
  if (overviewKey.value && !mapBlobs.value.has(overviewKey.value)) {
    const lines = shared.value.map((r) => ({ points: r.preview, color: r.color }))
    jobs.push([overviewKey.value, () => renderStaticMap(lines, { ...OVERVIEW_MAP, stroke: 4 })])
  }
  if (!jobs.length) {
    if (mapState.value === 'laden') mapState.value = 'fertig'
    return
  }
  mapState.value = 'laden'
  let missing = 0
  for (const [k, job] of jobs) {
    const blob = await job().catch(() => null)
    if (run !== mapRun) return
    if (!blob) {
      missing++
      continue
    }
    mapBlobs.value = new Map(mapBlobs.value).set(k, blob)
    mapUrls.value = new Map(mapUrls.value).set(k, URL.createObjectURL(blob))
  }
  mapState.value = missing ? 'fehlt' : 'fertig'
}
watch(online, (on) => {
  if (on && mapState.value === 'fehlt') void loadMaps()
})
onUnmounted(() => {
  mapRun++
  for (const u of mapUrls.value.values()) URL.revokeObjectURL(u)
})

/** Routen für die Vorlage; `src` liefert das Kartenbild (Vorschau: blob-Adresse, Datei: eingebettet) */
function routeInputsWith(src: (key: string) => string | undefined): RouteInput[] {
  return shared.value.map((r) => ({ name: r.name, color: r.color, kind: r.kind, stats: r.stats, points: r.preview, date: r.date, map: src(mapKey(r)) }))
}
const routeInputs = computed<RouteInput[]>(() => routeInputsWith((k) => mapUrls.value.get(k)))

async function showAllRoutes() {
  for (const r of hiddenRoutes.value) await routeRepository.update(r.id, { showInShare: true })
}
const accs = useLiveQuery(() => accommodationRepository.listByTrip(props.tripId), [] as Accommodation[])
const acts = useLiveQuery(() => activityRepository.listByTrip(props.tripId), [] as Activity[])
// Unterkünfte und Unternehmungen: nur unverfängliche Felder (kein Preis, keine Buchungsnummer, keine Notizen)
const stayInputs = computed<StayInput[]>(() =>
  chooseStays(accs.value).map((a) => ({ name: a.name, type: a.type, checkIn: a.checkIn, checkOut: a.checkOut, address: a.address, url: a.url, status: a.status }))
)
const activityInputs = computed<ActivityInput[]>(() =>
  chooseActivities(acts.value).map((a) => ({ title: a.title, category: a.category, date: a.plannedDate, place: a.place, status: a.status }))
)
const extra = computed<ExtraInput>(() => ({ stays: stayInputs.value, activities: activityInputs.value }))
const doneActivities = computed(() => acts.value.some((a) => a.status === 'erledigt'))

/** Auswahlknöpfe für die Bereiche der Seite */
type SectionKey = 'showPhotos' | 'showRoutes' | 'showStays' | 'showActivities' | 'showParticipants' | 'showMood' | 'showLocation'
const sectionButtons = computed<{ key: SectionKey; label: string; icon: string; count?: number }[]>(() => [
  { key: 'showPhotos', label: 'Fotos', icon: 'images', count: photos.value.length },
  { key: 'showRoutes', label: 'Routen', icon: 'signpost-split', count: routeInputs.value.length },
  { key: 'showStays', label: 'Unterkünfte', icon: 'building', count: stayInputs.value.length },
  { key: 'showActivities', label: 'Unternehmungen', icon: 'flag', count: activityInputs.value.length },
  { key: 'showParticipants', label: 'Mitreisende', icon: 'people', count: trip.value?.participants.length ?? 0 },
  { key: 'showLocation', label: 'Orte', icon: 'geo-alt' },
  { key: 'showMood', label: 'Stimmung', icon: 'emoji-smile' }
])

const previewUrls = useObjectUrls(photos, (p) => p.id, (p) => p.full)

const settings = reactive<WebsiteSettingsDraft>(defaultSettings({ title: '', destination: '', startDate: '2000-01-01', endDate: '2000-01-01' }))
const loaded = ref(false)

// Kartenbilder erzeugen, sobald Routen da sind bzw. sich ändern
watch(
  () => [settings.showRoutes, overviewKey.value, shared.value.map(mapKey).join(',')],
  () => {
    if (settings.showRoutes && shared.value.length) void loadMaps()
  },
  { immediate: true }
)

onMounted(async () => {
  trip.value = await tripRepository.get(props.tripId)
  if (!trip.value) return router.replace('/trip')
  const saved = await websiteRepository.get(props.tripId)
  const { tripId: _t, updatedAt: _u, ...rest } = saved ?? { tripId: '', updatedAt: '', ...defaultSettings(trip.value) }
  Object.assign(settings, rest)
  loaded.value = true
})

// Einstellungen automatisch speichern
let saveTimer: ReturnType<typeof setTimeout> | undefined
watch(settings, () => {
  if (!loaded.value) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => websiteRepository.save(props.tripId, { ...settings }), 500)
})

const highlightCount = computed(() => entries.value.filter((e) => e.highlight).length)

/** Einträge mit Bildquellen für die Vorlage */
function entryInputs(src: (p: Photo) => SitePhoto): EntryInput[] {
  const byEntry = new Map<string, Photo[]>()
  for (const p of photos.value) byEntry.set(p.entryId, [...(byEntry.get(p.entryId) ?? []), p])
  return entries.value.map((e) => ({
    date: e.date,
    title: e.title,
    text: e.text,
    mood: e.mood,
    location: e.location,
    highlight: e.highlight,
    createdAt: e.createdAt,
    photos: orderPhotos(e.photoIds, byEntry.get(e.id) ?? []).map(src)
  }))
}

const site = computed(() => {
  if (!trip.value) return null
  const data = buildSiteData(
    trip.value,
    settings,
    entryInputs((p) => ({ src: previewUrls.value.get(p.id) ?? '', caption: p.caption, width: p.width, height: p.height })),
    undefined,
    routeInputs.value,
    extra.value
  )
  const overview = settings.showRoutes && overviewKey.value ? mapUrls.value.get(overviewKey.value) : undefined
  return overview ? { ...data, overviewMap: overview } : data
})

// Vorschau (verzögert neu zeichnen, damit Tippen flüssig bleibt)
const previewHtml = ref('')
let previewTimer: ReturnType<typeof setTimeout> | undefined
watch(
  [site, () => ({ ...settings })],
  ([s]) => {
    clearTimeout(previewTimer)
    previewTimer = setTimeout(() => {
      previewHtml.value = s ? renderSite(s, { ...settings }, bootstrapCss, fontFaceCss(settings.font)) : ''
    }, 300)
  },
  { immediate: true, deep: true }
)

// Export als eine Datei mit eingebetteten Fotos
const exporting = ref(false)
const progress = ref({ done: 0, total: 0 })
const exported = ref<{ file: File; url: string } | null>(null)
const exportError = ref('')

async function buildFile() {
  if (!trip.value) return
  exporting.value = true
  exportError.value = ''
  if (exported.value) URL.revokeObjectURL(exported.value.url)
  exported.value = null
  try {
    const edge = IMAGE_EDGE[settings.imageSize].edge
    // Nur Fotos der gewählten Einträge umwandeln
    const chosen = new Set(settings.showPhotos ? entries.value.filter((e) => !settings.onlyHighlights || e.highlight).map((e) => e.id) : [])
    const needed = photos.value.filter((p) => chosen.has(p.entryId))
    progress.value = { done: 0, total: needed.length }
    const sources = new Map<string, SitePhoto>()
    for (const p of needed) {
      const r = await resizeBlob(p.full, edge, 0.8)
      sources.set(p.id, { src: await blobToDataUrl(r.blob), caption: p.caption, width: r.width, height: r.height })
      progress.value = { done: progress.value.done + 1, total: needed.length }
    }
    // Kartenbilder einbetten (noch fehlende jetzt versuchen)
    if (settings.showRoutes && shared.value.length) await loadMaps()
    const embedded = new Map<string, string>()
    for (const [k, b] of mapBlobs.value) embedded.set(k, await blobToDataUrl(b))
    const data = buildSiteData(
      trip.value,
      settings,
      entryInputs((p) => sources.get(p.id) ?? { src: '', caption: p.caption, width: p.width, height: p.height }),
      undefined,
      routeInputsWith((k) => embedded.get(k)),
      extra.value
    )
    const overview = settings.showRoutes && overviewKey.value ? embedded.get(overviewKey.value) : undefined
    if (overview) data.overviewMap = overview
    const html = renderSite(data, { ...settings }, bootstrapCss, await embeddedFontCss(settings.font))
    const file = new File([html], fileNameFor(settings.title || trip.value.title), { type: 'text/html' })
    exported.value = { file, url: URL.createObjectURL(file) }
  } catch (e) {
    exportError.value = (e as Error).message
  } finally {
    exporting.value = false
  }
}

const canShare = computed(() => {
  if (!exported.value || !navigator.canShare) return false
  try {
    return navigator.canShare({ files: [exported.value.file] })
  } catch {
    return false
  }
})

async function share() {
  if (!exported.value) return
  try {
    await navigator.share({ files: [exported.value.file], title: settings.title })
  } catch {
    /* abgebrochen */
  }
}

function resetTexts() {
  if (!trip.value) return
  const d = defaultSettings(trip.value)
  settings.title = d.title
  settings.subtitle = d.subtitle
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" title="Reise-Webseite" />

  <div class="row g-4">
    <!-- Einstellungen -->
    <div class="col-12 col-lg-5">
      <div v-if="entries.length === 0" class="alert alert-info small">
        Noch keine Tagebuch-Einträge. Die Webseite entsteht aus deinem
        <RouterLink :to="`/trip/${tripId}/tagebuch`">Reisetagebuch</RouterLink>.
      </div>
      <div v-else-if="settings.onlyHighlights && highlightCount === 0" class="alert alert-warning small">
        Noch keine Highlights. Markiere Einträge im Tagebuch mit ⭐ – oder schalte „Nur Highlights“ aus.
      </div>

      <h2 class="h6">Vorlage</h2>
      <div class="vstack gap-2 mb-3">
        <template v-for="(t, key) in TEMPLATE_INFO" :key="key">
          <input :id="`tpl-${key}`" v-model="settings.template" type="radio" class="btn-check" :value="key" />
          <label class="btn btn-outline-primary text-start" :for="`tpl-${key}`">
            <i :class="`bi bi-${t.icon} me-2`" aria-hidden="true"></i><strong>{{ t.title }}</strong>
            <span class="d-block small opacity-75">{{ t.description }}</span>
          </label>
        </template>
      </div>

      <h2 class="h6">Aussehen</h2>
      <div class="mb-2">
        <label class="form-label small mb-1">Akzentfarbe</label>
        <div class="d-flex flex-wrap gap-2 align-items-center">
          <button v-for="c in ACCENT_PRESETS" :key="c" type="button" class="swatch" :style="{ background: c }"
                  :class="{ active: settings.accent === c }" :aria-label="`Farbe ${c}`" @click="settings.accent = c"></button>
          <input v-model="settings.accent" type="color" class="form-control form-control-color" aria-label="Eigene Farbe" />
        </div>
      </div>
      <div class="row g-2 mb-2">
        <div class="col-7">
          <label for="font" class="form-label small mb-1">Schrift</label>
          <select id="font" v-model="settings.font" class="form-select form-select-sm">
            <optgroup v-for="g in FONT_GROUPS" :key="g.group" :label="g.group">
              <option v-for="f in g.fonts" :key="f.id" :value="f.id">{{ f.label }}</option>
            </optgroup>
          </select>
        </div>
        <div class="col-5 d-flex align-items-end">
          <div class="form-check form-switch mb-1">
            <input id="dark" v-model="settings.dark" class="form-check-input" type="checkbox" role="switch" />
            <label class="form-check-label small" for="dark">Dunkel</label>
          </div>
        </div>
      </div>

      <h2 class="h6 mt-3 d-flex justify-content-between">
        Texte
        <button type="button" class="btn btn-link btn-sm p-0" @click="resetTexts">aus Reise übernehmen</button>
      </h2>
      <div class="mb-2">
        <label for="title" class="form-label small mb-1">Titel</label>
        <input id="title" v-model="settings.title" class="form-control form-control-sm" />
      </div>
      <div class="mb-2">
        <label for="sub" class="form-label small mb-1">Untertitel</label>
        <input id="sub" v-model="settings.subtitle" class="form-control form-control-sm" />
      </div>
      <div class="mb-2">
        <label for="intro" class="form-label small mb-1">Einleitung</label>
        <textarea id="intro" v-model="settings.intro" rows="3" class="form-control form-control-sm"
                  placeholder="Ein paar Sätze vorweg – worum ging es auf dieser Reise?"></textarea>
      </div>
      <div class="mb-3">
        <label for="author" class="form-label small mb-1">Von</label>
        <input id="author" v-model="settings.author" class="form-control form-control-sm" placeholder="z. B. Anna & Tom" />
      </div>

      <h2 class="h6">Inhalt</h2>
      <div class="btn-group btn-group-sm w-100 mb-2" role="group" aria-label="Tagebuch">
        <input id="oh-yes" v-model="settings.onlyHighlights" type="radio" class="btn-check" :value="true" />
        <label class="btn btn-outline-primary" for="oh-yes"><i class="bi bi-star me-1" aria-hidden="true"></i>Nur Highlights ({{ highlightCount }})</label>
        <input id="oh-no" v-model="settings.onlyHighlights" type="radio" class="btn-check" :value="false" />
        <label class="btn btn-outline-primary" for="oh-no"><i class="bi bi-journal-text me-1" aria-hidden="true"></i>Ganzes Tagebuch ({{ entries.length }})</label>
      </div>
      <div class="small text-body-secondary mb-1">Was soll auf die Seite?</div>
      <div class="d-flex flex-wrap gap-2 mb-2">
        <template v-for="b in sectionButtons" :key="b.key">
          <input :id="`sec-${b.key}`" v-model="settings[b.key]" type="checkbox" class="btn-check" autocomplete="off" />
          <label class="btn btn-sm btn-outline-primary rounded-pill" :for="`sec-${b.key}`">
            <i :class="`bi bi-${b.icon} me-1`" aria-hidden="true"></i>{{ b.label }}<span v-if="b.count !== undefined" class="opacity-75"> ({{ b.count }})</span>
          </label>
        </template>
      </div>
      <div v-if="settings.showRoutes && hiddenRoutes.length" class="alert alert-light border small py-2 mb-2" data-hidden-routes>
        <i class="bi bi-signpost-split me-1" aria-hidden="true"></i>
        {{ hiddenRoutes.length === 1 ? '1 Route ist' : `${hiddenRoutes.length} Routen sind` }} nicht für die Webseite freigegeben
        <template v-if="hiddenRoutes.length <= 3">({{ hiddenRoutes.map((r) => r.name).join(', ') }})</template>.
        <button type="button" class="btn btn-link btn-sm p-0 align-baseline" @click="showAllRoutes">Alle zeigen</button>
      </div>
      <div v-if="settings.showRoutes && shared.length" class="small mb-2" :class="mapState === 'fehlt' ? 'text-warning-emphasis' : 'text-body-secondary'" data-map-state>
        <template v-if="mapState === 'laden'"><span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>Lade Kartenbilder …</template>
        <template v-else-if="mapState === 'fehlt'"><i class="bi bi-wifi-off me-1" aria-hidden="true"></i>Kartenbilder brauchen Internet – ohne sie zeigt die Seite nur die Strecke. <button type="button" class="btn btn-link btn-sm p-0 align-baseline" @click="loadMaps">Noch einmal versuchen</button></template>
        <template v-else-if="mapState === 'fertig'"><i class="bi bi-map me-1" aria-hidden="true"></i>Routen mit Karte (© OpenStreetMap-Mitwirkende){{ shared.length > 1 ? ' und Übersichtskarte' : '' }}.</template>
      </div>
      <div v-if="settings.showStays" class="form-check form-switch">
        <input id="stay-details" v-model="settings.showStayDetails" class="form-check-input" type="checkbox" role="switch" />
        <label class="form-check-label small" for="stay-details">Adresse und Link der Unterkünfte zeigen</label>
      </div>
      <p class="small text-body-secondary mb-2">
        Preise, Buchungsnummern und Notizen kommen nie auf die Seite.
        <template v-if="settings.showStays && accs.some((a) => a.status === 'gebucht')">Es werden nur gebuchte Unterkünfte gezeigt.</template>
        <template v-if="settings.showActivities">{{ ' ' }}{{ doneActivities ? 'Unternehmungen: nur erledigte.' : 'Unternehmungen: noch keine erledigt – es werden die geplanten gezeigt.' }}</template>
      </p>
      <label for="size" class="form-label small mb-1">Bildgröße</label>
      <select id="size" v-model="settings.imageSize" class="form-select form-select-sm mb-3">
        <option v-for="(s, key) in IMAGE_EDGE" :key="key" :value="key">{{ s.label }}</option>
      </select>

      <!-- Export -->
      <div class="card border-primary">
        <div class="card-body">
          <h2 class="h6">Webseite erstellen</h2>
          <p class="small text-body-secondary">Eine einzige HTML-Datei mit allen Fotos – funktioniert ohne Internet und in jedem Browser.</p>
          <button type="button" class="btn btn-primary w-100" :disabled="exporting || !(site?.days.length || site?.stays.length || site?.activities.length)" @click="buildFile">
            <template v-if="exporting">
              <span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
              Fotos {{ progress.done }} / {{ progress.total }}
            </template>
            <template v-else><i class="bi bi-magic me-1" aria-hidden="true"></i>Datei erstellen</template>
          </button>
          <div v-if="exportError" class="small text-danger mt-2">{{ exportError }}</div>

          <div v-if="exported" class="mt-3">
            <div class="small mb-2">
              <i class="bi bi-file-earmark-code me-1" aria-hidden="true"></i><strong>{{ exported.file.name }}</strong> · {{ formatBytes(exported.file.size) }}
              <span v-if="exported.file.size > 25 * 1024 * 1024" class="d-block text-warning-emphasis">
                Recht groß für E-Mails – „Bildgröße: Klein“ macht die Datei kleiner.
              </span>
            </div>
            <div class="d-flex flex-wrap gap-2">
              <button v-if="canShare" type="button" class="btn btn-success" @click="share">
                <i class="bi bi-box-arrow-up me-1" aria-hidden="true"></i>Teilen
              </button>
              <a :href="exported.url" :download="exported.file.name" class="btn btn-outline-primary">
                <i class="bi bi-download me-1" aria-hidden="true"></i>Herunterladen
              </a>
              <a :href="exported.url" target="_blank" rel="noopener" class="btn btn-outline-secondary">
                <i class="bi bi-box-arrow-up-right me-1" aria-hidden="true"></i>Öffnen
              </a>
            </div>
            <DonationHint class="mt-3 mb-0" text="Schön geworden? Die App ist kostenlos – über eine kleine Spende freue ich mich." />
          </div>

          <details class="small mt-3">
            <summary>Wie bringe ich die Seite ins Internet?</summary>
            <ol class="mt-2 ps-3 mb-0">
              <li>Auf github.com ein neues <strong>öffentliches</strong> Repository anlegen, z. B. „reise-gardasee“.</li>
              <li>„Add file → Upload files“: die Datei hochladen und in <code>index.html</code> umbenennen.</li>
              <li>Settings → Pages → „Deploy from a branch“, Branch <code>main</code>, Speichern.</li>
              <li>Nach 1–2 Minuten ist sie erreichbar unter <code>https://&lt;name&gt;.github.io/reise-gardasee/</code>.</li>
            </ol>
            <p class="mt-2 mb-0">Ohne Internet-Adresse geht es auch: Datei per AirDrop, Mail oder Messenger schicken – sie öffnet sich in jedem Browser.</p>
          </details>
        </div>
      </div>
    </div>

    <!-- Vorschau -->
    <div class="col-12 col-lg-7">
      <div class="preview-frame shadow-sm">
        <div class="preview-bar small text-body-secondary"><i class="bi bi-eye me-1" aria-hidden="true"></i>Vorschau</div>
        <!-- sandbox: in der Vorschau läuft kein Skript (Schutz vor eingeschleusten Inhalten); Fotos laden trotzdem -->
        <iframe v-if="previewHtml" :srcdoc="previewHtml" sandbox="allow-same-origin" title="Vorschau der Reise-Webseite" class="preview"></iframe>
      </div>
    </div>
  </div>
</template>

<style scoped>
.swatch {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 2px solid var(--bs-body-bg);
  box-shadow: 0 0 0 1px var(--bs-border-color);
}
.swatch.active {
  box-shadow: 0 0 0 3px var(--bs-body-color);
}
.preview-frame {
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius-lg);
  overflow: hidden;
  position: sticky;
  top: 4.5rem;
}
.preview-bar {
  padding: 0.35rem 0.75rem;
  background: var(--bs-tertiary-bg);
  border-bottom: 1px solid var(--bs-border-color);
}
.preview {
  width: 100%;
  height: 75vh;
  border: 0;
  background: #fff;
  display: block;
}
</style>
