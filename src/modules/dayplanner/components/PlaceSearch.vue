<script setup lang="ts">
import { onUnmounted, ref, watch } from 'vue'
import { searchPlaces, type Place } from '@/services/weather'

/** Ortssuche für die Wettervorhersage. Gibt den gewählten Ort per "select" zurück. */
const props = defineProps<{ initialQuery?: string }>()
const emit = defineEmits<{ select: [place: Place] }>()

const query = ref(props.initialQuery ?? '')
const results = ref<Place[]>([])
const loading = ref(false)
const error = ref('')
let controller: AbortController | undefined
let timer: ReturnType<typeof setTimeout> | undefined

async function run() {
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  error.value = ''
  try {
    // Nur der erste Teil vor einem Komma ("Riva del Garda, Italien" → "Riva del Garda") – die Suche mag kurze Namen
    const q = query.value.split(',')[0]
    results.value = await searchPlaces(q, controller.signal)
    if (!results.value.length && q.trim().length >= 2) error.value = 'Kein Ort gefunden. Anders schreiben oder größeren Ort wählen.'
  } catch (e) {
    if ((e as Error).name !== 'AbortError') error.value = navigator.onLine ? (e as Error).message : 'Für die Ortssuche wird Internet benötigt.'
  } finally {
    loading.value = false
  }
}

watch(query, () => {
  clearTimeout(timer)
  timer = setTimeout(run, 400)
}, { immediate: true })

onUnmounted(() => {
  clearTimeout(timer)
  controller?.abort()
})
</script>

<template>
  <div>
    <div class="input-group mb-2">
      <span class="input-group-text"><i class="bi bi-search" aria-hidden="true"></i></span>
      <input v-model="query" class="form-control" :placeholder="t('Ort für die Wettervorhersage')" :aria-label="t('Ort suchen')" />
      <span v-if="loading" class="input-group-text"><span class="spinner-border spinner-border-sm" aria-hidden="true"></span></span>
    </div>
    <div v-if="error" class="small text-body-secondary mb-2">{{ error }}</div>
    <div class="list-group">
      <button v-for="p in results" :key="`${p.latitude},${p.longitude}`" type="button"
              class="list-group-item list-group-item-action" @click="emit('select', p)">
        <i class="bi bi-geo-alt me-1 text-primary" aria-hidden="true"></i><strong>{{ p.name }}</strong>
        <span class="small text-body-secondary"> {{ p.region }}</span>
      </button>
    </div>
  </div>
</template>
