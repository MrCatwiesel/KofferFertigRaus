<script setup lang="ts">
/** Kompakter Hinweis auf gültige Warnungen an den Reiseorten (für den Tagesplan). */
import { computed, onMounted } from 'vue'
import { useLiveQuery } from '@/core/composables'
import { unwetterRepository } from '../repository'
import { aktuelle, betrifftReise, wo, zeitraum } from '../logic'
import { refreshIfStale } from '../refresh'
import { ART_ICON, STUFE_STIL, type UnwetterStand } from '../types'

const props = defineProps<{ tripId: string }>()
const stand = useLiveQuery(() => unwetterRepository.get(props.tripId), undefined as UnwetterStand | undefined)
const liste = computed(() => {
  const s = stand.value
  return s ? aktuelle(s).filter((w) => !w.ortlos && betrifftReise(w, s)) : []
})
onMounted(() => void refreshIfStale(props.tripId).catch(() => undefined))
</script>

<template>
  <RouterLink v-if="liste.length" :to="`/trip/${tripId}/unwetter`" class="alert d-block text-decoration-none py-2 mb-3 text-start" :class="STUFE_STIL[liste[0].stufe]?.alert" data-unwetter-hinweis>
    <div v-for="w in liste.slice(0, 3)" :key="w.id" class="d-flex gap-2 align-items-start">
      <i :class="`bi bi-${ART_ICON[w.art] ?? 'exclamation-triangle'}`" aria-hidden="true"></i>
      <span>
        <strong>{{ $t('Warnstufe {0}: {1}', [$t(w.stufeName), $t(w.artName)]) }}</strong> – {{ wo(w) }}
        <span class="small d-block">{{ zeitraum(w) }}</span>
      </span>
    </div>
    <div v-if="liste.length > 3" class="small">{{ $t('und {0} weitere …', [liste.length - 3]) }}</div>
  </RouterLink>
</template>
