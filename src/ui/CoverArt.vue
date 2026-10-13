<script setup lang="ts">
/**
 * Gezeichnetes Titelbild, wenn eine Reise (noch) kein Foto hat: Berge, Meer oder Stadt – je nach Reiseziel.
 * Farben kommen aus dem gewählten Stil, die Form ist für jede Reise etwas anders (aus der Kennung abgeleitet).
 */
import { computed } from 'vue'
import { coverMotif, ridge, seededRandom } from './cover-art'

const props = defineProps<{ seed: string; destination: string }>()

const motif = computed(() => coverMotif(props.destination))
const shapes = computed(() => {
  const r = seededRandom(props.seed)
  return {
    sunX: 480 + r() * 240,
    sunY: 70 + r() * 50,
    far: ridge(r, 150, 70, 9),
    mid: ridge(r, 195, 60, 7),
    near: ridge(r, 240, 40, 5),
    buildings: Array.from({ length: 16 }, (_, i) => ({ x: i * 52 - 10 + r() * 10, w: 34 + r() * 22, h: 50 + r() * 120 })),
    waves: Array.from({ length: 5 }, (_, i) => 205 + i * 18 + r() * 4)
  }
})
const uid = computed(() => `c${props.seed.replace(/[^a-z0-9]/gi, '').slice(0, 8)}`)
</script>

<template>
  <svg viewBox="0 0 800 300" preserveAspectRatio="xMidYMid slice" class="cover-art" aria-hidden="true">
    <defs>
      <linearGradient :id="`${uid}-sky`" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="var(--nww-sky-2)" />
        <stop offset="1" stop-color="var(--nww-sky-1)" />
      </linearGradient>
    </defs>
    <rect width="800" height="300" :fill="`url(#${uid}-sky)`" />
    <circle :cx="shapes.sunX" :cy="shapes.sunY" r="34" fill="var(--nww-sun, var(--nww-accent))" opacity="0.9" />
    <circle :cx="shapes.sunX" :cy="shapes.sunY" r="52" fill="var(--nww-sun, var(--nww-accent))" opacity="0.18" />

    <template v-if="motif === 'meer'">
      <path :d="shapes.far" fill="var(--nww-far)" opacity="0.6" transform="translate(0 40) scale(1 0.55)" />
      <rect y="190" width="800" height="110" fill="var(--nww-mid)" />
      <rect :x="shapes.sunX - 30" y="192" width="60" height="6" rx="3" fill="var(--nww-accent)" opacity="0.6" />
      <rect :x="shapes.sunX - 18" y="204" width="36" height="5" rx="2.5" fill="var(--nww-accent)" opacity="0.45" />
      <path v-for="(y, i) in shapes.waves" :key="i" :d="`M0 ${y} q 25 -8 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0 t 50 0`"
            fill="none" stroke="var(--nww-surface)" stroke-width="2" :opacity="0.25 + i * 0.08" />
      <path d="M0 300 L0 262 Q 160 236 330 268 T 800 258 L800 300 Z" fill="var(--nww-sky-1)" />
    </template>

    <template v-else-if="motif === 'stadt'">
      <path :d="shapes.far" fill="var(--nww-far)" opacity="0.5" transform="translate(0 30) scale(1 0.7)" />
      <g fill="var(--nww-mid)">
        <rect v-for="(b, i) in shapes.buildings" :key="i" :x="b.x" :y="300 - b.h - 40" :width="b.w" :height="b.h + 40" />
      </g>
      <g fill="var(--nww-sky-1)" opacity="0.55">
        <template v-for="(b, i) in shapes.buildings" :key="`w${i}`">
          <rect v-for="k in Math.floor(b.h / 26)" :key="k" :x="b.x + 7" :y="300 - b.h - 30 + k * 26" width="6" height="9" />
        </template>
      </g>
      <rect y="268" width="800" height="32" fill="var(--nww-near)" />
    </template>

    <template v-else>
      <path :d="shapes.far" fill="var(--nww-far)" />
      <path :d="shapes.mid" fill="var(--nww-mid)" />
      <path :d="shapes.near" fill="var(--nww-near)" />
    </template>
  </svg>
</template>

<style scoped>
.cover-art {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
