<script setup lang="ts">
/** Titelbild einer Reise wählen: eigenes Foto hochladen oder aus dem Tagebuch, Ausschnitt verschieben. */
import { computed, onMounted, onUnmounted, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'
import { getCoverPhotos, type CoverPhoto } from '@/core/registry'
import { resizeBlob } from '@/services/images'
import { tripRepository } from '../repository'
import type { Trip } from '../types'
import TripCover from '../components/TripCover.vue'
import TripContextHeader from '../components/TripContextHeader.vue'

const props = defineProps<{ id: string }>()
const router = useRouter()

const trip = shallowRef<Trip | null>(null)
const cover = shallowRef<Blob | null>(null)
const coverY = ref(50)
const photos = ref<(CoverPhoto & { url: string })[]>([])
const busy = ref(false)
const error = ref('')

onMounted(async () => {
  const t = await tripRepository.get(props.id)
  if (!t) return router.replace('/trip')
  trip.value = t
  cover.value = t.cover ?? null
  coverY.value = t.coverY ?? 50
  photos.value = (await getCoverPhotos(props.id)).map((p) => ({ ...p, url: URL.createObjectURL(p.thumb) }))
})
onUnmounted(() => photos.value.forEach((p) => URL.revokeObjectURL(p.url)))

const preview = computed(() => (trip.value ? { id: trip.value.id, destination: trip.value.destination, cover: cover.value, coverY: coverY.value } : null))

async function upload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  busy.value = true
  error.value = ''
  try {
    cover.value = (await resizeBlob(file, 1800, 0.82)).blob
    coverY.value = 50
  } catch (err) {
    error.value = `Bild konnte nicht gelesen werden: ${(err as Error).message}`
  } finally {
    busy.value = false
  }
}

function choose(p: CoverPhoto) {
  cover.value = p.full
  coverY.value = 50
}

async function save() {
  await tripRepository.setCover(props.id, cover.value, Math.round(coverY.value))
  router.push(`/trip/${props.id}`)
}
</script>

<template>
  <TripContextHeader :trip-id="id" title="Titelbild" />

  <div v-if="preview">
    <TripCover :trip="preview" class="preview mb-3">
      <div class="h-100 d-flex align-items-end p-3 text-white preview-text">
        <div>
          <div class="h3 mb-0">{{ trip!.title }}</div>
          <div class="small">{{ trip!.destination }}</div>
        </div>
      </div>
    </TripCover>

    <div v-if="cover" class="mb-3">
      <label for="cy" class="form-label small">Ausschnitt verschieben</label>
      <input id="cy" v-model.number="coverY" type="range" min="0" max="100" class="form-range" />
    </div>
    <p v-else class="small text-body-secondary">
      Ohne eigenes Foto zeichnet die App eine Landschaft passend zum Reiseziel (Berge, Meer oder Stadt) in den Farben deines Stils.
    </p>

    <div class="d-flex flex-wrap gap-2 mb-3">
      <label class="btn btn-outline-primary mb-0" :class="{ disabled: busy }">
        <span v-if="busy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
        <i v-else class="bi bi-upload me-1" aria-hidden="true"></i>Foto hochladen
        <input type="file" accept="image/*" class="d-none" @change="upload" />
      </label>
      <button v-if="cover" type="button" class="btn btn-outline-secondary" @click="cover = null">
        <i class="bi bi-brush me-1" aria-hidden="true"></i>Gezeichnete Landschaft
      </button>
    </div>
    <div v-if="error" class="alert alert-danger small py-2">{{ error }}</div>

    <template v-if="photos.length">
      <h2 class="h6 text-body-secondary">Aus dem Reisetagebuch</h2>
      <div class="photo-grid mb-3">
        <button v-for="p in photos" :key="p.id" type="button" class="photo" :class="{ active: cover === p.full }" :aria-label="p.caption || 'Foto wählen'" @click="choose(p)">
          <img :src="p.url" alt="" />
        </button>
      </div>
    </template>

    <div class="d-flex gap-2">
      <button type="button" class="btn btn-primary" @click="save">Speichern</button>
      <RouterLink :to="`/trip/${id}`" class="btn btn-outline-secondary">Abbrechen</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.preview {
  height: 220px;
  border-radius: var(--bs-border-radius-lg);
}
@media (min-width: 768px) {
  .preview {
    height: 280px;
  }
}
.preview-text {
  text-shadow: 0 1px 10px rgba(0, 0, 0, 0.5);
}
.photo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
  gap: 0.5rem;
}
.photo {
  aspect-ratio: 4 / 3;
  padding: 0;
  overflow: hidden;
  border: 3px solid transparent;
  border-radius: var(--bs-border-radius);
  background: var(--nww-surface-2);
}
.photo.active {
  border-color: var(--nww-primary);
}
.photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
</style>
