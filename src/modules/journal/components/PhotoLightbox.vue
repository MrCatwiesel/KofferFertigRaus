<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

/** Vollbildansicht für Fotos mit Wischen/Pfeiltasten. */
interface LightboxPhoto {
  id: string
  full: Blob
  caption: string
}

const props = defineProps<{ photos: LightboxPhoto[]; start: number }>()
const emit = defineEmits<{ close: [] }>()

const index = ref(props.start)
const url = ref('')
const current = computed(() => props.photos[index.value])

watch(
  current,
  (p) => {
    if (url.value) URL.revokeObjectURL(url.value)
    url.value = p ? URL.createObjectURL(p.full) : ''
  },
  { immediate: true }
)

function go(delta: number) {
  const n = props.photos.length
  if (n) index.value = (index.value + delta + n) % n
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
  if (e.key === 'ArrowRight') go(1)
  if (e.key === 'ArrowLeft') go(-1)
}

// Wischen auf dem Touchscreen
let touchX: number | null = null
function onTouchStart(e: TouchEvent) {
  touchX = e.touches[0]?.clientX ?? null
}
function onTouchEnd(e: TouchEvent) {
  if (touchX === null) return
  const dx = (e.changedTouches[0]?.clientX ?? touchX) - touchX
  if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1)
  touchX = null
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.body.style.overflow = 'hidden'
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
  if (url.value) URL.revokeObjectURL(url.value)
})
</script>

<template>
  <div class="lightbox" role="dialog" aria-modal="true" :aria-label="$t('Fotoansicht')" @touchstart.passive="onTouchStart" @touchend="onTouchEnd">
    <button type="button" class="btn btn-dark lb-close" :aria-label="$t('Schließen')" @click="emit('close')">
      <i class="bi bi-x-lg" aria-hidden="true"></i>
    </button>
    <button v-if="photos.length > 1" type="button" class="btn btn-dark lb-nav lb-prev" :aria-label="$t('Vorheriges Foto')" @click="go(-1)">
      <i class="bi bi-chevron-left" aria-hidden="true"></i>
    </button>
    <img v-if="url" :src="url" :alt="current?.caption || $t('Foto')" class="lb-img" />
    <button v-if="photos.length > 1" type="button" class="btn btn-dark lb-nav lb-next" :aria-label="$t('Nächstes Foto')" @click="go(1)">
      <i class="bi bi-chevron-right" aria-hidden="true"></i>
    </button>
    <div class="lb-caption">
      <span v-if="current?.caption">{{ current.caption }}</span>
      <span class="opacity-75 ms-2">{{ index + 1 }} / {{ photos.length }}</span>
    </div>
  </div>
</template>

<style scoped>
.lightbox {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.94);
  display: flex;
  align-items: center;
  justify-content: center;
}
.lb-img {
  max-width: 100%;
  max-height: calc(100% - 4rem);
  object-fit: contain;
}
.lb-close {
  position: absolute;
  top: calc(0.75rem + env(safe-area-inset-top));
  right: 0.75rem;
}
.lb-nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  opacity: 0.7;
}
.lb-prev {
  left: 0.5rem;
}
.lb-next {
  right: 0.5rem;
}
.lb-caption {
  position: absolute;
  bottom: calc(0.75rem + env(safe-area-inset-bottom));
  left: 0;
  right: 0;
  text-align: center;
  color: #fff;
  font-size: 0.9rem;
  padding: 0 1rem;
}
</style>
