<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import bootstrapCssRaw from 'bootstrap/dist/css/bootstrap.min.css?raw'
import { useLiveQuery } from '@/core/composables'
import { formatBytes } from '@/core/storage'
import DonationHint from '@/ui/DonationHint.vue'
import { blobToDataUrl, resizeBlob } from '@/services/images'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import { journalRepository, orderPhotos, photoRepository, useObjectUrls, type JournalEntry, type Photo } from '@/modules/journal/public'
import { routeRepository, type Route } from '@/modules/routes/public'
import { websiteRepository } from '../repository'
import { buildSiteData, defaultSettings, fileNameFor, type EntryInput, type RouteInput } from '../logic'
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
const routeInputs = computed<RouteInput[]>(() =>
  routes.value
    .filter((r) => r.showInShare)
    .map((r) => ({ name: r.name, color: r.color, kind: r.kind, stats: r.stats, points: r.preview, date: r.date }))
)
const previewUrls = useObjectUrls(photos, (p) => p.id, (p) => p.full)

const settings = reactive<WebsiteSettingsDraft>(defaultSettings({ title: '', destination: '', startDate: '2000-01-01', endDate: '2000-01-01' }))
const loaded = ref(false)

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
  return buildSiteData(
    trip.value,
    settings,
    entryInputs((p) => ({ src: previewUrls.value.get(p.id) ?? '', caption: p.caption, width: p.width, height: p.height })),
    undefined,
    routeInputs.value
  )
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
    const chosen = new Set(entries.value.filter((e) => !settings.onlyHighlights || e.highlight).map((e) => e.id))
    const needed = photos.value.filter((p) => chosen.has(p.entryId))
    progress.value = { done: 0, total: needed.length }
    const sources = new Map<string, SitePhoto>()
    for (const p of needed) {
      const r = await resizeBlob(p.full, edge, 0.8)
      sources.set(p.id, { src: await blobToDataUrl(r.blob), caption: p.caption, width: r.width, height: r.height })
      progress.value = { done: progress.value.done + 1, total: needed.length }
    }
    const data = buildSiteData(
      trip.value,
      settings,
      entryInputs((p) => sources.get(p.id) ?? { src: '', caption: p.caption, width: p.width, height: p.height }),
      undefined,
      routeInputs.value
    )
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
      <div class="form-check form-switch">
        <input id="oh" v-model="settings.onlyHighlights" class="form-check-input" type="checkbox" role="switch" />
        <label class="form-check-label small" for="oh">Nur Highlights ({{ highlightCount }} von {{ entries.length }} Einträgen)</label>
      </div>
      <div class="form-check form-switch">
        <input id="mood" v-model="settings.showMood" class="form-check-input" type="checkbox" role="switch" />
        <label class="form-check-label small" for="mood">Stimmung zeigen</label>
      </div>
      <div class="form-check form-switch mb-2">
        <input id="loc" v-model="settings.showLocation" class="form-check-input" type="checkbox" role="switch" />
        <label class="form-check-label small" for="loc">Orte zeigen</label>
      </div>
      <label for="size" class="form-label small mb-1">Bildgröße</label>
      <select id="size" v-model="settings.imageSize" class="form-select form-select-sm mb-3">
        <option v-for="(s, key) in IMAGE_EDGE" :key="key" :value="key">{{ s.label }}</option>
      </select>

      <!-- Export -->
      <div class="card border-primary">
        <div class="card-body">
          <h2 class="h6">Webseite erstellen</h2>
          <p class="small text-body-secondary">Eine einzige HTML-Datei mit allen Fotos – funktioniert ohne Internet und in jedem Browser.</p>
          <button type="button" class="btn btn-primary w-100" :disabled="exporting || !site?.days.length" @click="buildFile">
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
        <iframe v-if="previewHtml" :srcdoc="previewHtml" title="Vorschau der Reise-Webseite" class="preview"></iframe>
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
