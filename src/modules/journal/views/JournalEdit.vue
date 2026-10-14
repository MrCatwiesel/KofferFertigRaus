<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, onUnmounted, reactive, ref, shallowRef, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { formatDayShort } from '@/core/format'
import { requestPersistentStorage } from '@/core/storage'
import { getDayFacts, getPhotoSources, notifyPhotosAdded, type AddedPhoto, type PhotoSource, type PickedPhoto } from '@/core/registry'
import { formatDate } from '@/core/format'
import { diffDays } from '@/core/dates'
import { applyDayDraft, composeDayDraft } from '../draft'
import { processImage } from '@/services/images'
import { readExif, type ExifInfo } from '@/services/exif'
import { TripContextHeader, tripRepository, type Trip } from '@/modules/trip/public'
import { journalRepository, photoRepository, voiceNoteRepository, type NewPhoto } from '../repository'
import VoiceNotesEditor, { type VoiceItem } from '../components/VoiceNotesEditor.vue'
import { defaultEntryDate, emptyEntryDraft, moveItem, orderPhotos, takenAtFromFile, validateEntry } from '../logic'
import { MOODS, type JournalEntryDraft, type Photo } from '../types'
import PhotoLightbox from '../components/PhotoLightbox.vue'

const props = defineProps<{ tripId: string; id?: string }>()
const router = useRouter()
const route = useRoute()

const draft = reactive<JournalEntryDraft>(emptyEntryDraft())
const trip = ref<Trip>()
const submitted = ref(false)
const saving = ref(false)
const processing = ref(0)
const photoError = ref('')
const listPath = computed(() => `/trip/${props.tripId}/tagebuch`)

/** Ein Foto im Formular: vorhanden (aus der Datenbank) oder neu (noch nicht gespeichert). */
interface PhotoItem {
  key: string
  url: string
  full: Blob
  caption: string
  existing?: Photo
  fresh?: NewPhoto
  /** Originaldatei eines neuen eigenen Fotos (z. B. zum Hochladen in eine Galerie) */
  original?: File
}
const items = ref<PhotoItem[]>([])
const removed: string[] = []
// Sprachnotizen
const voices = ref<VoiceItem[]>([])
const removedVoices: string[] = []
function onVoiceRemoved(v: VoiceItem) {
  if (v.existingId) removedVoices.push(v.existingId)
  URL.revokeObjectURL(v.url)
}

onMounted(async () => {
  trip.value = await tripRepository.get(props.tripId)
  if (!trip.value) return router.replace('/trip')
  if (!props.id) {
    const q = typeof route.query.tag === 'string' ? route.query.tag : ''
    draft.date = q || defaultEntryDate(trip.value.startDate, trip.value.endDate)
    if (route.query.entwurf) await fillFromDay()
    return
  }
  const entry = await journalRepository.get(props.id)
  if (!entry) return router.replace(listPath.value)
  const { id: _i, tripId: _t, photoIds, createdAt: _c, updatedAt: _u, ...rest } = entry
  Object.assign(draft, rest)
  const photos = orderPhotos(photoIds, await photoRepository.listByEntry(props.id))
  items.value = photos.map((p) => ({ key: p.id, url: URL.createObjectURL(p.thumb), full: p.full, caption: p.caption, existing: p }))
  voices.value = (await voiceNoteRepository.listByEntry(props.id)).map((v) => ({
    key: v.id, url: URL.createObjectURL(v.audio), title: v.title, savedTitle: v.title, duration: v.duration, recordedAt: v.recordedAt, audio: v.audio, existingId: v.id
  }))
})

onUnmounted(() => {
  items.value.forEach((i) => URL.revokeObjectURL(i.url))
  voices.value.forEach((v) => URL.revokeObjectURL(v.url))
})

// Entwurf aus dem, was an diesem Tag gespeichert ist (Touren, Unternehmungen, Wetter …)
const draftNote = ref<{ ok: boolean; text: string } | null>(null)
const drafting = ref(false)
async function fillFromDay() {
  if (!trip.value || !draft.date) return
  drafting.value = true
  try {
    const facts = await getDayFacts(props.tripId, draft.date)
    const d = composeDayDraft(facts, { dayNo: diffDays(trip.value.startDate, draft.date) + 1, destination: trip.value.destination })
    if (!d.facts) {
      draftNote.value = { ok: false, text: `Für den ${formatDate(draft.date)} ist noch nichts gespeichert – keine Tour, Unternehmung, Anreise oder Wettervorhersage.` }
      return
    }
    Object.assign(draft, applyDayDraft(draft, d))
    draftNote.value = { ok: true, text: 'Entwurf eingefügt – jetzt mit eigenen Worten ergänzen: Was war besonders, lustig, lecker?' }
  } finally {
    drafting.value = false
  }
}

// Weitere Fotoquellen (z. B. Piwigo), von anderen Modulen angemeldet
const sources = ref<PhotoSource[]>([])
const activeSource = shallowRef<Component | null>(null)
onMounted(async () => {
  const all = getPhotoSources()
  const ok = await Promise.all(all.map((s) => s.available().catch(() => false)))
  sources.value = all.filter((_, i) => ok[i])
})
function openSource(src: PhotoSource) {
  activeSource.value = defineAsyncComponent(src.component as () => Promise<Component>)
}

function placeFromExif(exif: ExifInfo | null): Pick<NewPhoto, 'lat' | 'lon' | 'placeSource'> {
  return exif?.lat !== undefined && exif.lon !== undefined ? { lat: exif.lat, lon: exif.lon, placeSource: 'exif' } : {}
}

async function addPicked(picked: PickedPhoto[]) {
  activeSource.value = null
  photoError.value = ''
  requestPersistentStorage()
  for (const p of picked) {
    processing.value++
    try {
      const [img, exif] = await Promise.all([processImage(p.blob), readExif(p.blob)])
      const fresh: NewPhoto = {
        full: img.full, thumb: img.thumb, width: img.width, height: img.height,
        caption: p.caption, takenAt: p.takenAt || exif?.takenAt || new Date().toISOString(),
        externalRef: p.externalRef, externalUrl: p.externalUrl,
        ...placeFromExif(exif)
      }
      items.value.push({ key: `tmp-${crypto.randomUUID()}`, url: URL.createObjectURL(img.thumb), full: img.full, caption: p.caption, fresh })
    } catch (e) {
      photoError.value = (e as Error).message
    } finally {
      processing.value--
    }
  }
}

async function addFiles(event: Event) {
  const input = event.target as HTMLInputElement
  const files = [...(input.files ?? [])]
  input.value = ''
  if (!files.length) return
  photoError.value = ''
  // Beim ersten Foto um dauerhaften Speicher bitten (Safari löscht sonst ggf. Daten)
  requestPersistentStorage()
  for (const file of files) {
    processing.value++
    try {
      // Ort und Zeit aus der Originaldatei – nach dem Verkleinern sind sie weg
      const [img, exif] = await Promise.all([processImage(file), readExif(file)])
      const fresh: NewPhoto = {
        full: img.full, thumb: img.thumb, width: img.width, height: img.height, caption: '', takenAt: exif?.takenAt ?? takenAtFromFile(file),
        ...placeFromExif(exif)
      }
      items.value.push({ key: `tmp-${crypto.randomUUID()}`, url: URL.createObjectURL(img.thumb), full: img.full, caption: '', fresh, original: file })
    } catch (e) {
      photoError.value = `${file.name}: ${(e as Error).message}`
    } finally {
      processing.value--
    }
  }
}

function removePhoto(i: number) {
  const [it] = items.value.splice(i, 1)
  if (it.existing) removed.push(it.existing.id)
  URL.revokeObjectURL(it.url)
}

function move(i: number, delta: -1 | 1) {
  items.value = moveItem(items.value, i, delta)
}

const errors = computed(() => validateEntry(draft, items.value.length))
const lightboxStart = ref<number | null>(null)
const lightboxPhotos = computed(() => items.value.map((i) => ({ id: i.key, full: i.full, caption: i.caption })))

async function save() {
  submitted.value = true
  if (Object.keys(errors.value).length || processing.value) return
  saving.value = true
  try {
    const fresh: NewPhoto[] = []
    const originals: (File | undefined)[] = []
    const order: string[] = []
    for (const it of items.value) {
      if (it.fresh) {
        order.push(`new:${fresh.length}`)
        fresh.push({ ...it.fresh, caption: it.caption.trim() })
        originals.push(it.original)
      } else if (it.existing) {
        order.push(it.existing.id)
        if (it.caption !== it.existing.caption) await photoRepository.setCaption(it.existing.id, it.caption.trim())
      }
    }
    const plain: JournalEntryDraft = { ...draft, title: draft.title.trim(), location: draft.location.trim() }
    const voice = {
      added: voices.value.filter((v) => !v.existingId).map((v) => ({ audio: v.audio, duration: v.duration, title: v.title.trim(), recordedAt: v.recordedAt })),
      removed: removedVoices,
      titles: voices.value.filter((v) => v.existingId && v.title.trim() !== v.savedTitle).map((v) => ({ id: v.existingId!, title: v.title.trim() }))
    }
    const { entryId, newPhotoIds } = await journalRepository.save(props.tripId, props.id, plain, fresh, order, removed, voice)
    // Neue eigene Fotos anderen Modulen melden (z. B. Hochladen nach Piwigo) – im Hintergrund
    const added: AddedPhoto[] = []
    newPhotoIds.forEach((photoId, i) => {
      const original = originals[i]
      if (original && !fresh[i].externalRef) {
        added.push({ photoId, tripId: props.tripId, entryId, original, filename: original.name, caption: fresh[i].caption, takenAt: fresh[i].takenAt })
      }
    })
    notifyPhotosAdded(added)
    router.push(listPath.value)
  } finally {
    saving.value = false
  }
}

async function remove() {
  if (!props.id || !confirm('Diesen Eintrag mit allen Fotos löschen?')) return
  await journalRepository.remove(props.id)
  router.replace(listPath.value)
}
</script>

<template>
  <TripContextHeader :trip-id="tripId" :title="id ? 'Eintrag bearbeiten' : 'Neuer Eintrag'" />

  <form class="row g-3" novalidate @submit.prevent="save">
    <div class="col-6 col-md-4">
      <label for="date" class="form-label">Tag</label>
      <input id="date" v-model="draft.date" type="date" class="form-control" :class="{ 'is-invalid': submitted && errors.date }" />
      <div class="form-text">{{ draft.date ? formatDayShort(draft.date) : '' }}</div>
    </div>
    <div class="col-6 col-md-8">
      <label for="loc" class="form-label">Wo?</label>
      <input id="loc" v-model="draft.location" class="form-control" placeholder="z. B. Malcesine" />
    </div>
    <div class="col-12">
      <label for="title" class="form-label">Überschrift</label>
      <input id="title" v-model="draft.title" class="form-control" placeholder="z. B. Mit der Seilbahn auf den Monte Baldo" />
    </div>

    <div class="col-12">
      <label class="form-label d-block">Wie war der Tag?</label>
      <div class="d-flex flex-wrap gap-1" role="radiogroup" aria-label="Stimmung">
        <button v-for="m in MOODS" :key="m.value" type="button" class="btn mood-btn"
                :class="draft.mood === m.value ? 'btn-primary' : 'btn-outline-secondary'" :aria-pressed="draft.mood === m.value"
                :title="m.label" @click="draft.mood = draft.mood === m.value ? 0 : m.value">
          <span class="fs-4">{{ m.emoji }}</span><span class="d-block small">{{ m.label }}</span>
        </button>
      </div>
    </div>

    <div class="col-12">
      <div class="d-flex flex-wrap align-items-end justify-content-between gap-2 mb-2">
        <label for="text" class="form-label mb-0">Erlebt</label>
        <button type="button" class="btn btn-sm btn-outline-primary" :disabled="drafting || !draft.date" data-day-draft @click="fillFromDay">
          <span v-if="drafting" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
          <i v-else class="bi bi-magic me-1" aria-hidden="true"></i>Entwurf aus dem Tag
        </button>
      </div>
      <div v-if="draftNote" class="small mb-2" :class="draftNote.ok ? 'text-success' : 'text-body-secondary'" role="status" data-draft-note>{{ draftNote.text }}</div>
      <textarea id="text" v-model="draft.text" rows="7" class="form-control"
                placeholder="Was habt ihr gemacht? Was war besonders, lustig, lecker?"></textarea>
    </div>

    <!-- Sprachnotizen -->
    <div class="col-12">
      <label class="form-label d-block">Sprachnotizen</label>
      <VoiceNotesEditor v-model="voices" @removed="onVoiceRemoved" />
    </div>

    <!-- Fotos -->
    <div class="col-12">
      <label class="form-label d-block">Fotos</label>
      <div class="photo-grid mb-2">
        <figure v-for="(it, i) in items" :key="it.key" class="photo-item m-0">
          <button type="button" class="photo-thumb" :aria-label="`Foto ${i + 1} groß anzeigen`" @click="lightboxStart = i">
            <img :src="it.url" alt="" />
            <span v-if="i === 0" class="badge text-bg-primary cover">Titelbild</span>
            <span v-if="(it.existing ?? it.fresh)?.externalRef" class="badge text-bg-light external" title="Original liegt in der Galerie">
              <i class="bi bi-cloud-check" aria-hidden="true"></i>
            </span>
          </button>
          <input v-model="it.caption" class="form-control form-control-sm mt-1" placeholder="Bildunterschrift" :aria-label="`Bildunterschrift ${i + 1}`" />
          <div class="d-flex justify-content-between mt-1">
            <div class="btn-group btn-group-sm">
              <button type="button" class="btn btn-outline-secondary" :disabled="i === 0" aria-label="Nach vorn" @click="move(i, -1)">
                <i class="bi bi-chevron-left" aria-hidden="true"></i>
              </button>
              <button type="button" class="btn btn-outline-secondary" :disabled="i === items.length - 1" aria-label="Nach hinten" @click="move(i, 1)">
                <i class="bi bi-chevron-right" aria-hidden="true"></i>
              </button>
            </div>
            <button type="button" class="btn btn-sm btn-outline-danger" aria-label="Foto entfernen" @click="removePhoto(i)">
              <i class="bi bi-trash" aria-hidden="true"></i>
            </button>
          </div>
        </figure>

        <label class="photo-add">
          <template v-if="processing">
            <span class="spinner-border text-primary" aria-hidden="true"></span>
            <span class="small mt-2">Bereite {{ processing }} vor …</span>
          </template>
          <template v-else>
            <i class="bi bi-camera fs-2" aria-hidden="true"></i>
            <span class="small mt-1">Fotos hinzufügen</span>
          </template>
          <input type="file" accept="image/*" multiple class="d-none" @change="addFiles" />
        </label>
      </div>
      <div v-if="sources.length" class="d-flex flex-wrap gap-2 mb-2">
        <button v-for="src in sources" :key="src.label" type="button" class="btn btn-sm btn-outline-primary" :disabled="processing > 0" @click="openSource(src)">
          <i :class="`bi bi-${src.icon} me-1`" aria-hidden="true"></i>{{ src.label }}
        </button>
      </div>
      <div v-if="photoError" class="small text-danger">{{ photoError }}</div>
      <div class="form-text">Fotos werden verkleinert gespeichert (max. 2048 px) – spart Platz auf dem Gerät.</div>
    </div>

    <div class="col-12">
      <div class="form-check form-switch">
        <input id="hl" v-model="draft.highlight" class="form-check-input" type="checkbox" role="switch" />
        <label class="form-check-label" for="hl"><i class="bi bi-star-fill text-warning me-1" aria-hidden="true"></i>Highlight – kommt auf die Reise-Webseite</label>
      </div>
    </div>

    <div v-if="submitted && errors.content" class="col-12 text-danger small">{{ errors.content }}</div>

    <div class="col-12 d-flex gap-2">
      <button type="submit" class="btn btn-primary" :disabled="saving || processing > 0">
        <span v-if="saving" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
        <i v-else class="bi bi-check-lg me-1" aria-hidden="true"></i>Speichern
      </button>
      <RouterLink :to="listPath" class="btn btn-outline-secondary">Abbrechen</RouterLink>
      <button v-if="id" type="button" class="btn btn-outline-danger ms-auto" @click="remove">
        <i class="bi bi-trash me-1" aria-hidden="true"></i>Löschen
      </button>
    </div>
  </form>

  <PhotoLightbox v-if="lightboxStart !== null" :photos="lightboxPhotos" :start="lightboxStart" @close="lightboxStart = null" />
  <component :is="activeSource" v-if="activeSource" :trip-id="tripId" @picked="addPicked" @close="activeSource = null" />
</template>

<style scoped>
.mood-btn {
  min-width: 4.8rem;
  line-height: 1.1;
}
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.75rem;
}
.photo-thumb {
  position: relative;
  display: block;
  width: 100%;
  aspect-ratio: 1;
  border: 0;
  padding: 0;
  border-radius: var(--bs-border-radius);
  overflow: hidden;
  background: var(--bs-secondary-bg);
}
.photo-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.photo-thumb .cover {
  position: absolute;
  left: 0.35rem;
  top: 0.35rem;
}
.photo-thumb .external {
  position: absolute;
  right: 0.35rem;
  bottom: 0.35rem;
}
.photo-add {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2px dashed var(--bs-border-color);
  border-radius: var(--bs-border-radius);
  color: var(--bs-primary);
  cursor: pointer;
}
</style>
