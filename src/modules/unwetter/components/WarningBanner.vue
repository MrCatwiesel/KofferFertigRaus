<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useLiveQuery } from '@/core/composables'
import { getMeta } from '@/core/meta'
import { refreshIfStale } from '../api'
import { overlapsDay, period, relevantWarnings } from '../logic'
import { LEVELS, TYPE_ICONS, type WarningCache } from '../types'

/** Kurzer Hinweis auf Unwetterwarnungen (z. B. im Tagesplaner) – nur, wenn es welche gibt. `day`: nur die dieses Tages */
const props = defineProps<{ tripId: string; day?: string }>()
const cache = useLiveQuery(() => getMeta<WarningCache | null>(`unwetter.${props.tripId}`, null), null as WarningCache | null)
const list = computed(() => relevantWarnings(cache.value).filter((w) => !props.day || overlapsDay(w, props.day)))
onMounted(() => void refreshIfStale(props.tripId).catch(() => undefined))
</script>

<template>
  <RouterLink v-if="list.length" :to="`/trip/${tripId}/unwetter`" class="card mb-3 text-decoration-none banner" data-warning-banner>
    <div v-for="w in list.slice(0, 3)" :key="w.id" class="card-body py-2 d-flex align-items-center gap-2 small" :style="{ borderLeft: `0.4rem solid ${(LEVELS[w.level] ?? LEVELS[2]).bg}` }">
      <i :class="`bi bi-${TYPE_ICONS[w.type] ?? 'exclamation-triangle'} fs-5`" aria-hidden="true"></i>
      <span><strong>{{ (LEVELS[w.level] ?? LEVELS[2]).label }}: {{ w.typeName }}</strong> · {{ w.match?.area }} · {{ period(w.onset, w.expires) }}</span>
      <i class="bi bi-chevron-right ms-auto" aria-hidden="true"></i>
    </div>
    <div v-if="list.length > 3" class="card-body py-1 small text-body-secondary">und {{ list.length - 3 }} weitere</div>
  </RouterLink>
</template>

<style scoped>
.banner .card-body + .card-body {
  border-top: 1px solid var(--bs-border-color);
}
</style>
