<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { db } from '../db'
import { exportTrip, importBackup } from '../backup'
import { describeStats } from '../merge'
import { formatBytes } from '../storage'
import { fileSlug } from '@/services/share-file'

/** Eine Reise als Datei teilen und die Datei der Mitreisenden wieder einlesen (ohne Server). */
const props = defineProps<{ tripId: string }>()
const router = useRouter()

const title = ref('')
const includePhotos = ref(false)
const busy = ref(false)
const file = ref<File | null>(null)
const fileUrl = ref('')
const message = ref<{ type: 'success' | 'danger'; text: string } | null>(null)

onMounted(async () => {
  const t = await db.trips.get(props.tripId)
  if (!t) return router.replace('/trip')
  title.value = t.title
})

const fileName = computed(() => {
  return `koffer-fertig-raus-${fileSlug(title.value)}-${new Date().toISOString().slice(0, 10)}.json`
})

async function create() {
  busy.value = true
  message.value = null
  try {
    const { blob } = await exportTrip(props.tripId, { includeLarge: includePhotos.value })
    if (fileUrl.value) URL.revokeObjectURL(fileUrl.value)
    file.value = new File([blob], fileName.value, { type: 'application/json' })
    fileUrl.value = URL.createObjectURL(file.value)
  } catch (e) {
    message.value = { type: 'danger', text: (e as Error).message }
  } finally {
    busy.value = false
  }
}

const canShare = computed(() => {
  if (!file.value || !navigator.canShare) return false
  try {
    return navigator.canShare({ files: [file.value] })
  } catch {
    return false
  }
})

async function share() {
  if (!file.value) return
  try {
    await navigator.share({ files: [file.value], title: `Reise: ${title.value}` })
  } catch {
    /* abgebrochen */
  }
}

async function readBack(event: Event) {
  const input = event.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f) return
  busy.value = true
  try {
    const result = await importBackup(
      f,
      (meta) => !meta.scope || meta.scope.tripId === props.tripId || confirm(`Diese Datei gehört zur Reise „${meta.scope.title}“, nicht zu „${title.value}“. Trotzdem einlesen?`)
    )
    if (result) message.value = { type: 'success', text: `Abgeglichen: ${describeStats(result.stats)}.` }
  } catch (e) {
    message.value = { type: 'danger', text: `Einlesen fehlgeschlagen: ${(e as Error).message}` }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="mb-3">
    <RouterLink :to="`/trip/${tripId}`" class="small text-decoration-none"><i class="bi bi-chevron-left" aria-hidden="true"></i> {{ title || 'Zurück' }}</RouterLink>
    <h1 class="h3 mb-0 mt-1">Mit Mitreisenden teilen</h1>
  </div>

  <div v-if="message" class="alert" :class="`alert-${message.type}`">{{ message.text }}</div>

  <div class="card mb-3">
    <div class="card-body">
      <h2 class="h6"><span class="badge text-bg-primary me-1">1</span> Reise als Datei verschicken</h2>
      <p class="small text-body-secondary">
        Die Datei enthält die ganze Reise: Planung, Packliste, Apotheke, Dokumente, Tagebuch, Ausgaben, Karte.
        Schick sie per AirDrop oder Nachricht an das andere Gerät.
      </p>
      <div class="form-check form-switch mb-2">
        <input id="photos" v-model="includePhotos" class="form-check-input" type="checkbox" role="switch" />
        <label class="form-check-label small" for="photos">Tagebuch-Fotos mitschicken (Datei wird größer)</label>
      </div>
      <button type="button" class="btn btn-primary" :disabled="busy" @click="create">
        <span v-if="busy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
        <i v-else class="bi bi-file-earmark-arrow-up me-1" aria-hidden="true"></i>Datei erstellen
      </button>
      <div v-if="file" class="mt-3">
        <div class="small mb-2"><strong>{{ file.name }}</strong> · {{ formatBytes(file.size) }}</div>
        <div class="d-flex flex-wrap gap-2">
          <button v-if="canShare" type="button" class="btn btn-success" @click="share"><i class="bi bi-box-arrow-up me-1" aria-hidden="true"></i>Teilen</button>
          <a :href="fileUrl" :download="file.name" class="btn btn-outline-primary"><i class="bi bi-download me-1" aria-hidden="true"></i>Herunterladen</a>
        </div>
      </div>
    </div>
  </div>

  <div class="card mb-3">
    <div class="card-body">
      <h2 class="h6"><span class="badge text-bg-primary me-1">2</span> Auf dem anderen Gerät einlesen</h2>
      <p class="small text-body-secondary">
        Dort die App öffnen → Einstellungen → „Backup oder geteilte Reise einlesen“ (oder hier, wenn die Reise schon da ist).
        Neues kommt dazu, bei Unterschieden gewinnt die neuere Änderung.
      </p>
      <label class="btn btn-outline-primary" :class="{ disabled: busy }">
        <i class="bi bi-file-earmark-arrow-down me-1" aria-hidden="true"></i>Datei der Mitreisenden einlesen
        <input type="file" accept="application/json,.json" class="d-none" @change="readBack" />
      </label>
    </div>
  </div>

  <div class="alert alert-light border small">
    <i class="bi bi-info-circle me-1" aria-hidden="true"></i>
    Gut zu wissen: Gelöschtes wird nicht übertragen – was auf einem Gerät gelöscht wurde, bleibt auf dem anderen erhalten.
    Am besten abwechselnd abgleichen: A schickt an B, B liest ein und schickt zurück.
  </div>
</template>
