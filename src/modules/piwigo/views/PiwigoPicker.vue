<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import type { PickedPhoto } from '@/core/registry'
import { PiwigoApi } from '../api'
import { externalRef, piwigoDate, sortAlbums, uploadTitle } from '../logic'
import { albumLinkRepository } from '../repository'
import type { PiwigoAlbum, PiwigoImage } from '../types'

/** Fotos aus Piwigo auswählen (Fotoquelle für das Tagebuch). */
const props = defineProps<{ tripId: string }>()
const emit = defineEmits<{ picked: [PickedPhoto[]]; close: [] }>()

const PER_PAGE = 60
let api: PiwigoApi | null = null
const albums = ref<PiwigoAlbum[]>([])
const albumId = ref<number | null>(null)
const tripAlbumId = ref<number | null>(null)
const images = ref<PiwigoImage[]>([])
const total = ref(0)
const page = ref(0)
const thumbs = ref<Record<number, string>>({})
const selected = ref<number[]>([])
const loading = ref(false)
const error = ref('')
const progress = ref('')
const abort = new AbortController()

const sorted = computed(() => sortAlbums(albums.value))
const hasMore = computed(() => images.value.length < total.value)

onMounted(async () => {
  document.body.classList.add('overflow-hidden')
  loading.value = true
  try {
    api = await PiwigoApi.fromSync()
    if (!api) throw new Error('Geräte-Abgleich ist nicht eingerichtet.')
    const [list, link] = await Promise.all([api.albums(), albumLinkRepository.get(props.tripId)])
    albums.value = list
    tripAlbumId.value = link?.albumId ?? null
    albumId.value = link && list.some((a) => a.id === link.albumId) ? link.albumId : null
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  document.body.classList.remove('overflow-hidden')
  abort.abort()
  Object.values(thumbs.value).forEach((u) => URL.revokeObjectURL(u))
})

watch(albumId, async (id) => {
  images.value = []
  total.value = 0
  page.value = 0
  selected.value = []
  if (id) await loadPage(0)
})

async function loadPage(p: number) {
  if (!api || !albumId.value) return
  loading.value = true
  error.value = ''
  try {
    const r = await api.images(albumId.value, p, PER_PAGE)
    images.value = p === 0 ? r.images : [...images.value, ...r.images]
    total.value = r.total
    page.value = p
    void loadThumbs(r.images)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

/** Vorschaubilder nachladen (4 gleichzeitig). */
async function loadThumbs(list: PiwigoImage[]) {
  const queue = list.filter((i) => !thumbs.value[i.id])
  const worker = async () => {
    for (let img = queue.shift(); img; img = queue.shift()) {
      try {
        const blob = await api!.imageBlob(img.id, 'small', abort.signal)
        thumbs.value = { ...thumbs.value, [img.id]: URL.createObjectURL(blob) }
      } catch {
        if (abort.signal.aborted) return
      }
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])
}

function toggle(id: number) {
  selected.value = selected.value.includes(id) ? selected.value.filter((x) => x !== id) : [...selected.value, id]
}

async function take() {
  if (!api || !selected.value.length) return
  loading.value = true
  error.value = ''
  const picked: PickedPhoto[] = []
  try {
    const chosen = images.value.filter((i) => selected.value.includes(i.id))
    for (const [n, img] of chosen.entries()) {
      progress.value = `Lade Foto ${n + 1} von ${chosen.length} …`
      const blob = await api.imageBlob(img.id, 'xxlarge', abort.signal)
      // Piwigo-Titel nur übernehmen, wenn er mehr ist als der Dateiname
      const title = img.name && img.name !== uploadTitle('', img.file) ? img.name : ''
      picked.push({ blob, caption: title, takenAt: piwigoDate(img.takenAt), externalRef: externalRef(img.id), externalUrl: img.pageUrl })
    }
    emit('picked', picked)
  } catch (e) {
    if (!abort.signal.aborted) error.value = (e as Error).message
  } finally {
    loading.value = false
    progress.value = ''
  }
}
</script>

<template>
  <div class="modal d-block" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="pwg-title" @keydown.esc="emit('close')">
    <div class="modal-dialog modal-fullscreen-sm-down modal-xl modal-dialog-scrollable">
      <div class="modal-content">
        <div class="modal-header">
          <h2 id="pwg-title" class="modal-title h5"><i class="bi bi-images me-2" aria-hidden="true"></i>{{ $t('Aus Piwigo') }}</h2>
          <button type="button" class="btn-close" :aria-label="$t('Schließen')" @click="emit('close')"></button>
        </div>
        <div class="modal-body">
          <label for="pwg-album" class="form-label">{{ $t('Album') }}</label>
          <select id="pwg-album" v-model="albumId" class="form-select mb-3" :disabled="!albums.length">
            <option :value="null">{{ $t('– Album wählen –') }}</option>
            <option v-for="a in sorted" :key="a.id" :value="a.id">
              {{ a.name }} ({{ a.images }}){{ a.id === tripAlbumId ? $t(' · Album dieser Reise') : '' }}
            </option>
          </select>

          <div v-if="error" class="alert alert-warning py-2">{{ error }}</div>
          <p v-if="albumId && !loading && !images.length && !error" class="text-body-secondary">{{ $t('Keine Fotos in diesem Album.') }}</p>

          <div class="pwg-grid">
            <button v-for="img in images" :key="img.id" type="button" class="pwg-item"
                    :class="{ selected: selected.includes(img.id) }" :aria-pressed="selected.includes(img.id)"
                    :aria-label="img.name || img.file" @click="toggle(img.id)">
              <img v-if="thumbs[img.id]" :src="thumbs[img.id]" alt="" loading="lazy" />
              <span v-else class="placeholder-glow w-100 h-100 d-block"><span class="placeholder w-100 h-100"></span></span>
              <i v-if="selected.includes(img.id)" class="bi bi-check-circle-fill check" aria-hidden="true"></i>
            </button>
          </div>

          <div v-if="hasMore" class="text-center mt-3">
            <button type="button" class="btn btn-outline-secondary" :disabled="loading" @click="loadPage(page + 1)">{{ $t('Weitere Fotos laden') }}</button>
          </div>
          <div v-if="loading && !progress" class="text-center my-3"><span class="spinner-border text-primary" :aria-label="$t('Lädt')"></span></div>
        </div>
        <div class="modal-footer">
          <span class="me-auto small text-body-secondary">{{ progress || (selected.length ? `${selected.length} ausgewählt` : $t('Fotos antippen zum Auswählen')) }}</span>
          <button type="button" class="btn btn-outline-secondary" @click="emit('close')">{{ $t('Abbrechen') }}</button>
          <button type="button" class="btn btn-primary" :disabled="!selected.length || loading" @click="take">
            <span v-if="progress" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
            {{ $t('Übernehmen') }}
          </button>
        </div>
      </div>
    </div>
  </div>
  <div class="modal-backdrop show"></div>
</template>

<style scoped>
.pwg-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
  gap: 0.5rem;
}
.pwg-item {
  position: relative;
  aspect-ratio: 1;
  padding: 0;
  border: 3px solid transparent;
  border-radius: var(--bs-border-radius);
  overflow: hidden;
  background: var(--bs-secondary-bg);
}
.pwg-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pwg-item.selected {
  border-color: var(--bs-primary);
}
.pwg-item .check {
  position: absolute;
  right: 0.3rem;
  top: 0.2rem;
  font-size: 1.4rem;
  color: var(--bs-primary);
  filter: drop-shadow(0 0 2px #fff);
}
</style>
