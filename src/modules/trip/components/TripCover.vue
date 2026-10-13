<script setup lang="ts">
/** Titelbild einer Reise: eigenes Foto oder gezeichnete Landschaft im Stil der App. Inhalt (Titel …) per Slot darüber. */
import { onUnmounted, ref, watch } from 'vue'
import CoverArt from '@/ui/CoverArt.vue'
import type { Trip } from '../types'

const props = defineProps<{ trip: Pick<Trip, 'id' | 'destination' | 'cover' | 'coverY'> }>()

const url = ref<string | null>(null)
watch(
  () => props.trip.cover,
  (b) => {
    if (url.value) URL.revokeObjectURL(url.value)
    url.value = b instanceof Blob ? URL.createObjectURL(b) : null
  },
  { immediate: true }
)
onUnmounted(() => url.value && URL.revokeObjectURL(url.value))
</script>

<template>
  <div class="trip-cover">
    <img v-if="url" :src="url" alt="" class="trip-cover-img" :style="{ objectPosition: `50% ${trip.coverY ?? 50}%` }" />
    <CoverArt v-else :seed="trip.id" :destination="trip.destination" />
    <div class="trip-cover-shade"></div>
    <div class="trip-cover-content"><slot /></div>
  </div>
</template>

<style scoped>
.trip-cover {
  position: relative;
  overflow: hidden;
  isolation: isolate;
  background: var(--nww-sky-1);
}
.trip-cover > :deep(svg),
.trip-cover-img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.trip-cover-shade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.12) 0%, rgba(0, 0, 0, 0) 30%, rgba(0, 0, 0, 0.6) 100%);
}
.trip-cover-content {
  position: relative;
  height: 100%;
  color: #fff;
  --bs-heading-color: #fff;
}
</style>
