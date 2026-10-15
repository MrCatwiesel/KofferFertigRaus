<script setup lang="ts">
/** Karte aller Reisen: ein Punkt je Reise (Unterkunft bzw. Start einer Tour), antippen öffnet die Reise. */
import { markRaw, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

const props = defineProps<{ points: { id: string; title: string; sub: string; at: [number, number] }[] }>()
const emit = defineEmits<{ open: [id: string] }>()
const el = ref<HTMLElement>()
let map: L.Map | null = null
let layer: L.LayerGroup | null = null

function draw() {
  if (!map || !layer) return
  layer.clearLayers()
  const color = getComputedStyle(document.documentElement).getPropertyValue('--nww-primary').trim() || '#2f5d50'
  for (const p of props.points) {
    L.circleMarker(p.at, { radius: 9, color: '#fff', weight: 2, fillColor: color, fillOpacity: 0.95 })
      .bindTooltip(`<b>${p.title.replace(/</g, '&lt;')}</b><br>${p.sub.replace(/</g, '&lt;')}`)
      .on('click', () => emit('open', p.id))
      .addTo(layer)
  }
  if (props.points.length) map.fitBounds(L.latLngBounds(props.points.map((p) => p.at)), { padding: [30, 30], maxZoom: 9 })
}

onMounted(async () => {
  await nextTick()
  if (!el.value) return
  map = markRaw(L.map(el.value, { zoomControl: true, scrollWheelZoom: false }).setView([48, 11], 4))
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    crossOrigin: true, // mit CORS laden – dann taugen die gemerkten Kacheln auch fürs Kartenbild im Reisebericht
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-Mitwirkende'
  }).addTo(map)
  layer = markRaw(L.layerGroup().addTo(map))
  draw()
})
watch(() => props.points, draw, { deep: true })
onUnmounted(() => map?.remove())
</script>

<template>
  <div ref="el" class="trips-map rounded" role="region" :aria-label="t('Karte aller Reisen')"></div>
</template>

<style scoped>
.trips-map {
  height: 340px;
  z-index: 0;
}
</style>
