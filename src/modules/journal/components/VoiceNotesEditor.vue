<script setup lang="ts">
/**
 * Sprachnotizen eines Tagebuch-Eintrags: aufnehmen, anhören, benennen, löschen.
 * Neue Aufnahmen werden erst mit dem Eintrag gespeichert.
 */
import { onUnmounted, ref } from 'vue'
import { canRecord, formatSeconds, startRecording, type Recording } from '@/services/recorder'
import { requestPersistentStorage } from '@/core/storage'

export interface VoiceItem {
  key: string
  url: string
  title: string
  duration: number
  recordedAt: string
  audio: Blob
  /** ID einer schon gespeicherten Notiz */
  existingId?: string
  /** Titel beim Laden (um Änderungen zu erkennen) */
  savedTitle?: string
}

const items = defineModel<VoiceItem[]>({ required: true })
const emit = defineEmits<{ removed: [item: VoiceItem] }>()

const supported = canRecord()
const recording = ref<Recording | null>(null)
const starting = ref(false)
const seconds = ref(0)
const level = ref(0)
const error = ref('')
let tick = 0

async function start() {
  error.value = ''
  starting.value = true
  requestPersistentStorage() // Safari löscht sonst ggf. Daten
  try {
    recording.value = await startRecording(() => void stop())
    tick = window.setInterval(() => {
      seconds.value = recording.value?.elapsed() ?? 0
      level.value = recording.value?.level() ?? 0
    }, 200)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    starting.value = false
  }
}

async function stop() {
  const r = recording.value
  if (!r) return
  clearInterval(tick)
  recording.value = null
  const { blob, duration } = await r.stop()
  seconds.value = 0
  level.value = 0
  if (!blob.size || duration < 0.5) {
    error.value = 'Die Aufnahme war leer – bitte noch einmal.'
    return
  }
  items.value = [
    ...items.value,
    { key: `neu-${crypto.randomUUID()}`, url: URL.createObjectURL(blob), title: '', duration, recordedAt: new Date().toISOString(), audio: blob }
  ]
}

function remove(i: number) {
  const it = items.value[i]
  if (!confirm(`Sprachnotiz ${it.title ? `„${it.title}“ ` : ''}löschen?`)) return
  items.value = items.value.filter((_, k) => k !== i)
  emit('removed', it)
}

const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

onUnmounted(() => {
  clearInterval(tick)
  recording.value?.cancel()
})
</script>

<template>
  <div class="voice-notes" data-voice-notes>
    <div v-for="(it, i) in items" :key="it.key" class="voice-item" data-voice-item>
      <audio :src="it.url" controls preload="metadata" class="flex-grow-1"></audio>
      <div class="d-flex gap-2 align-items-center w-100">
        <input
          v-model="it.title"
          class="form-control form-control-sm"
          :placeholder="`Sprachnotiz ${timeOf(it.recordedAt)} · ${formatSeconds(it.duration)}`"
          :aria-label="`Titel der Sprachnotiz ${i + 1}`"
        />
        <button type="button" class="btn btn-sm btn-outline-danger flex-none" :aria-label="`Sprachnotiz ${i + 1} löschen`" @click="remove(i)">
          <i class="bi bi-trash" aria-hidden="true"></i>
        </button>
      </div>
    </div>

    <div v-if="recording" class="d-flex align-items-center gap-2" role="status" data-recording>
      <span class="rec-dot" :style="{ transform: `scale(${1 + level * 0.8})` }" aria-hidden="true"></span>
      <span class="font-monospace">{{ formatSeconds(seconds) }}</span>
      <span class="small text-body-secondary">Aufnahme läuft …</span>
      <button type="button" class="btn btn-danger btn-sm ms-auto" data-stop-recording @click="stop"><i class="bi bi-stop-fill me-1" aria-hidden="true"></i>Fertig</button>
    </div>
    <button v-else-if="supported" type="button" class="btn btn-outline-primary btn-sm" :disabled="starting" data-start-recording @click="start">
      <span v-if="starting" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
      <i v-else class="bi bi-mic-fill me-1" aria-hidden="true"></i>Sprachnotiz aufnehmen
    </button>
    <p v-else class="small text-body-secondary mb-0">Dieser Browser kann keinen Ton aufnehmen.</p>
    <div v-if="error" class="small text-danger mt-1" role="alert">{{ error }}</div>
  </div>
</template>

<style scoped>
.voice-notes {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}
.voice-item {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  padding: 0.5rem;
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius);
}
.voice-item audio {
  width: 100%;
  height: 36px;
}
.voice-notes > .btn {
  align-self: flex-start;
}
.rec-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--bs-danger);
  transition: transform 0.15s;
}
.flex-none {
  flex: none;
}
</style>
