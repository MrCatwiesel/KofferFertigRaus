<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { downloadBlob, exportBackup, importBackup } from '../backup'
import { formatBytes, requestPersistentStorage, storageInfo, type StorageInfo } from '../storage'
import { describeStats } from '../merge'
import { t } from '@/i18n'

const message = ref<{ type: 'success' | 'danger'; text: string } | null>(null)
const includePhotos = ref(false)
const busy = ref(false)
/** Fortschritt beim Sichern/Einlesen (0…1), null = nichts läuft */
const progress = ref<{ label: string; value: number } | null>(null)
const storage = ref<StorageInfo | null>(null)

async function refreshStorage() {
  storage.value = await storageInfo()
}
onMounted(refreshStorage)

async function doExport() {
  busy.value = true
  try {
    progress.value = { label: t('Sicherung wird erstellt'), value: 0 }
    const { blob, exportedAt } = await exportBackup({ includeLarge: includePhotos.value, onProgress: (v) => (progress.value = { label: t('Sicherung wird erstellt'), value: v }) })
    const suffix = includePhotos.value ? '-mit-fotos' : ''
    downloadBlob(blob, `koffer-fertig-raus-backup-${exportedAt.slice(0, 10)}${suffix}.json`)
    message.value = { type: 'success', text: t('Backup wurde heruntergeladen ({formatBytes}).', { formatBytes: formatBytes(blob.size) }) }
  } catch (err) {
    message.value = { type: 'danger', text: t('Export fehlgeschlagen: {x}', { x: (err as Error).message }) }
  } finally {
    busy.value = false
    progress.value = null
  }
}

async function doImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  busy.value = true
  try {
    progress.value = { label: t('Wird eingelesen'), value: 0 }
    const result = await importBackup(file, undefined, (v) => (progress.value = { label: t('Wird eingelesen'), value: v }))
    if (result) {
      const what = result.meta.scope ? t('Reise „{title}“', { title: result.meta.scope.title }) : t('Backup')
      message.value = { type: 'success', text: `${what} eingelesen: ${describeStats(result.stats)}.` }
    }
    await refreshStorage()
  } catch (err) {
    message.value = { type: 'danger', text: t('Import fehlgeschlagen: {x}', { x: (err as Error).message }) }
  } finally {
    input.value = ''
    busy.value = false
    progress.value = null
  }
}

async function persist() {
  const ok = await requestPersistentStorage()
  await refreshStorage()
  message.value = ok
    ? { type: 'success', text: t('Der Browser behält die Daten jetzt dauerhaft.') }
    : { type: 'danger', text: t('Der Browser hat abgelehnt. Tipp: App über „Teilen → Zum Home-Bildschirm“ installieren und dort öffnen.') }
}
</script>

<template>
  <h1 class="h3 mb-3">{{ t('Daten & Sicherung') }}</h1>
  <div v-if="message" class="alert" :class="`alert-${message.type}`">{{ message.text }}</div>

  <section class="card mb-3">
    <div class="card-body">
      <h2 class="h5">{{ t('Datensicherung') }}</h2>
      <p class="text-body-secondary small">
        {{ t('Alle Daten liegen nur auf diesem Gerät. Sichere sie regelmäßig als Datei – damit kannst du sie auch auf ein anderes Gerät übertragen. Beim Einlesen wird zusammengeführt: Neues kommt dazu, bei Unterschieden gewinnt die neuere Änderung.') }}
      </p>
      <div class="form-check form-switch mb-2">
        <input id="photos" v-model="includePhotos" class="form-check-input" type="checkbox" role="switch" />
        <label class="form-check-label" for="photos">{{ t('Fotos mitsichern (Datei wird deutlich größer)') }}</label>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <button class="btn btn-outline-primary" :disabled="busy" @click="doExport">
          <span v-if="busy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
          <i v-else class="bi bi-download me-1" aria-hidden="true"></i>{{ t('Backup exportieren') }}
        </button>
        <label class="btn btn-outline-secondary mb-0" :class="{ disabled: busy }">
          <i class="bi bi-upload me-1" aria-hidden="true"></i>{{ t('Backup oder geteilte Reise einlesen') }}
          <input type="file" accept="application/json" class="d-none" @change="doImport" />
        </label>
      </div>
      <div v-if="progress" class="mt-2" data-progress>
        <div class="small text-body-secondary mb-1">{{ progress.label }} … {{ Math.round(progress.value * 100) }} %</div>
        <div class="progress" role="progressbar" :aria-valuenow="Math.round(progress.value * 100)" aria-valuemin="0" aria-valuemax="100" :aria-label="progress.label">
          <div class="progress-bar" :style="{ width: `${progress.value * 100}%` }"></div>
        </div>
      </div>
    </div>
  </section>

  <section id="speicher" class="card mb-3">
    <div class="card-body">
      <h2 class="h5">{{ t('Speicher') }}</h2>
      <p v-if="storage?.usedBytes != null" class="small mb-1">
        {{ t('Belegt:') }} <strong>{{ formatBytes(storage.usedBytes) }}</strong>
        <template v-if="storage.quotaBytes"> {{ t('von ca. {formatBytes} verfügbar', { formatBytes: formatBytes(storage.quotaBytes) }) }}</template>
      </p>
      <p class="small mb-2">
        <template v-if="storage?.persisted">
          <i class="bi bi-shield-check text-success me-1" aria-hidden="true"></i>{{ t('Daten werden dauerhaft behalten.') }}
        </template>
        <template v-else>
          <i class="bi bi-exclamation-triangle text-warning me-1" aria-hidden="true"></i>
          {{ t('Der Browser darf die Daten bei Platzmangel löschen. Regelmäßig sichern!') }}
        </template>
      </p>
      <button v-if="!storage?.persisted" type="button" class="btn btn-sm btn-outline-primary" @click="persist">
        {{ t('Dauerhaft speichern anfragen') }}
      </button>
    </div>
  </section>

  <p class="small text-body-secondary on-bg">
    <i class="bi bi-hdd-network me-1" aria-hidden="true"></i>{{ t('Sicherung des eigenen Servers (NAS, SMB, SSH, WebDAV): Einstellungen → Gemeinsam reisen → Geräte-Abgleich.') }}
  </p>
</template>
