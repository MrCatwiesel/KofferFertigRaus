<script setup lang="ts">
import { markRaw, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/** Karte mit einer oder mehreren Strecken (OpenStreetMap). */
interface MapLine {
  id: string
  name: string
  color: string
  points: [number, number][]
}
const props = withDefaults(defineProps<{ lines: MapLine[]; height?: string; markers?: boolean }>(), { height: '320px', markers: false })
const emit = defineEmits<{ select: [id: string] }>()

const el = ref<HTMLElement>()
let map: L.Map | null = null
let layer: L.LayerGroup | null = null

function draw() {
  if (!map || !layer) return
  layer.clearLayers()
  const all: L.LatLngExpression[] = []
  for (const line of props.lines) {
    if (line.points.length < 2) continue
    L.polyline(line.points, { color: '#fff', weight: 7, opacity: 0.8 }).addTo(layer)
    const pl = L.polyline(line.points, { color: line.color, weight: 4 }).addTo(layer)
    pl.bindTooltip(line.name, { sticky: true })
    pl.on('click', () => emit('select', line.id))
    if (props.markers) {
      L.circleMarker(line.points[0], { radius: 7, color: '#fff', weight: 2, fillColor: '#16a34a', fillOpacity: 1 }).bindTooltip('Start').addTo(layer)
      L.circleMarker(line.points[line.points.length - 1], { radius: 7, color: '#fff', weight: 2, fillColor: '#111827', fillOpacity: 1 }).bindTooltip('Ziel').addTo(layer)
    }
    all.push(...line.points)
  }
  if (all.length) map.fitBounds(L.latLngBounds(all), { padding: [24, 24], maxZoom: 15 })
}

onMounted(async () => {
  await nextTick()
  if (!el.value) return
  map = markRaw(L.map(el.value, { zoomControl: true }).setView([47.5, 11.5], 6))
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    crossOrigin: true, // mit CORS laden – dann taugen die gemerkten Kacheln auch fürs Kartenbild im Reisebericht
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende'
  }).addTo(map)
  layer = markRaw(L.layerGroup().addTo(map))
  draw()
})

watch(() => props.lines, draw, { deep: true })

onUnmounted(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <div ref="el" class="route-map rounded border" :style="{ height }" role="region" :aria-label="t('Karte mit Strecken')"></div>
</template>

<style scoped>
.route-map {
  z-index: 0;
}
</style>
