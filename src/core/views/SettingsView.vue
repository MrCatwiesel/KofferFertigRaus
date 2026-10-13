<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { downloadJson, exportBackup, importBackup, type BackupFile } from '../backup'
import { formatBytes, requestPersistentStorage, storageInfo, type StorageInfo } from '../storage'
import { describeStats } from '../merge'
import { APP_CONFIG, APP_VERSION } from '@/config'
import AppLogo from '@/ui/AppLogo.vue'
import { appearance } from '@/ui/appearance'
import { getTheme } from '@/ui/themes'
import { lock } from '../lock'

const message = ref<{ type: 'success' | 'danger'; text: string } | null>(null)
const includePhotos = ref(false)
const busy = ref(false)
const storage = ref<StorageInfo | null>(null)

async function refreshStorage() {
  storage.value = await storageInfo()
}
onMounted(refreshStorage)

async function doExport() {
  busy.value = true
  try {
    const data = await exportBackup({ includeLarge: includePhotos.value })
    const suffix = includePhotos.value ? '-mit-fotos' : ''
    downloadJson(data, `nix-wie-weg-backup-${data.exportedAt.slice(0, 10)}${suffix}.json`)
    message.value = { type: 'success', text: 'Backup wurde heruntergeladen.' }
  } catch (err) {
    message.value = { type: 'danger', text: `Export fehlgeschlagen: ${(err as Error).message}` }
  } finally {
    busy.value = false
  }
}

async function doImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  busy.value = true
  try {
    const data = JSON.parse(await file.text()) as BackupFile
    const stats = await importBackup(data)
    const what = data.scope ? `Reise „${data.scope.title}“` : 'Backup'
    message.value = { type: 'success', text: `${what} eingelesen: ${describeStats(stats)}.` }
    await refreshStorage()
  } catch (err) {
    message.value = { type: 'danger', text: `Import fehlgeschlagen: ${(err as Error).message}` }
  } finally {
    input.value = ''
    busy.value = false
  }
}

async function persist() {
  const ok = await requestPersistentStorage()
  await refreshStorage()
  message.value = ok
    ? { type: 'success', text: 'Der Browser behält die Daten jetzt dauerhaft.' }
    : { type: 'danger', text: 'Der Browser hat abgelehnt. Tipp: App über „Teilen → Zum Home-Bildschirm“ installieren und dort öffnen.' }
}
</script>

<template>
  <h1 class="h3 mb-3">Einstellungen</h1>

  <div v-if="message" class="alert" :class="`alert-${message.type}`">{{ message.text }}</div>

  <RouterLink to="/einstellungen/aussehen" class="card mb-3 text-decoration-none text-body">
    <div class="card-body d-flex align-items-center gap-3">
      <AppLogo :size="40" />
      <div class="flex-grow-1">
        <div class="h5 mb-0">Aussehen</div>
        <div class="small text-body-secondary">Design „{{ getTheme(appearance.theme).label }}“ · Hintergrund · Schrift · Reiseseite anpassen</div>
      </div>
      <i class="bi bi-chevron-right text-body-secondary" aria-hidden="true"></i>
    </div>
  </RouterLink>

  <RouterLink to="/einstellungen/sperre" class="card mb-3 text-decoration-none text-body">
    <div class="card-body d-flex align-items-center gap-3">
      <i class="bi fs-3" :class="lock.enabled ? 'bi-shield-lock-fill text-success' : 'bi-shield-lock text-primary'" aria-hidden="true"></i>
      <div class="flex-grow-1">
        <div class="h5 mb-0">App-Sperre</div>
        <div class="small text-body-secondary">{{ lock.enabled ? `An${lock.biometric ? ' · mit Face ID / Touch ID' : ''}` : 'Aus – mit Code oder Face ID schützen' }}</div>
      </div>
      <i class="bi bi-chevron-right text-body-secondary" aria-hidden="true"></i>
    </div>
  </RouterLink>

  <RouterLink to="/abgleich" class="card mb-3 text-decoration-none text-body">
    <div class="card-body d-flex align-items-center gap-3">
      <i class="bi bi-cloud-arrow-up-fill fs-3 text-primary" aria-hidden="true"></i>
      <div class="flex-grow-1">
        <div class="h5 mb-0">Geräte-Abgleich</div>
        <div class="small text-body-secondary">Handys, Tablet und PC automatisch auf demselben Stand halten</div>
      </div>
      <i class="bi bi-chevron-right text-body-secondary" aria-hidden="true"></i>
    </div>
  </RouterLink>

  <section class="card mb-3">
    <div class="card-body">
      <h2 class="h5">Datensicherung</h2>
      <p class="text-body-secondary small">
        Alle Daten liegen nur auf diesem Gerät. Sichere sie regelmäßig als Datei –
        damit kannst du sie auch auf ein anderes Gerät übertragen. Beim Einlesen wird zusammengeführt:
        Neues kommt dazu, bei Unterschieden gewinnt die neuere Änderung.
      </p>
      <div class="form-check form-switch mb-2">
        <input id="photos" v-model="includePhotos" class="form-check-input" type="checkbox" role="switch" />
        <label class="form-check-label" for="photos">Fotos mitsichern (Datei wird deutlich größer)</label>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <button class="btn btn-outline-primary" :disabled="busy" @click="doExport">
          <span v-if="busy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
          <i v-else class="bi bi-download me-1" aria-hidden="true"></i>Backup exportieren
        </button>
        <label class="btn btn-outline-secondary mb-0" :class="{ disabled: busy }">
          <i class="bi bi-upload me-1" aria-hidden="true"></i>Backup oder geteilte Reise einlesen
          <input type="file" accept="application/json" class="d-none" @change="doImport" />
        </label>
      </div>
    </div>
  </section>

  <section class="card mb-3">
    <div class="card-body">
      <h2 class="h5">Speicher</h2>
      <p v-if="storage?.usedBytes != null" class="small mb-1">
        Belegt: <strong>{{ formatBytes(storage.usedBytes) }}</strong>
        <template v-if="storage.quotaBytes"> von ca. {{ formatBytes(storage.quotaBytes) }} verfügbar</template>
      </p>
      <p class="small mb-2">
        <template v-if="storage?.persisted">
          <i class="bi bi-shield-check text-success me-1" aria-hidden="true"></i>Daten werden dauerhaft behalten.
        </template>
        <template v-else>
          <i class="bi bi-exclamation-triangle text-warning me-1" aria-hidden="true"></i>
          Der Browser darf die Daten bei Platzmangel löschen. Regelmäßig sichern!
        </template>
      </p>
      <button v-if="!storage?.persisted" type="button" class="btn btn-sm btn-outline-primary" @click="persist">
        Dauerhaft speichern anfragen
      </button>
    </div>
  </section>

  <section class="card">
    <div class="card-body">
      <h2 class="h5">Über „{{ APP_CONFIG.name }}“</h2>
      <p class="small text-body-secondary">
        Version {{ APP_VERSION }} · Freie Software unter der <a :href="APP_CONFIG.licenseUrl" target="_blank" rel="noopener">{{ APP_CONFIG.license }}</a>,
        entwickelt in der Freizeit. Kostenlos, ohne Werbung, ohne Konto – deine Daten bleiben auf deinen Geräten bzw. deinem eigenen Server.
      </p>
      <div class="d-flex flex-wrap gap-2">
        <a v-if="APP_CONFIG.donationUrl" :href="APP_CONFIG.donationUrl" target="_blank" rel="noopener" class="btn btn-sm btn-outline-danger">
          <i class="bi bi-heart-fill me-1" aria-hidden="true"></i>Über {{ APP_CONFIG.donationLabel }} unterstützen
        </a>
        <a :href="APP_CONFIG.repositoryUrl" target="_blank" rel="noopener" class="btn btn-sm btn-outline-secondary">
          <i class="bi bi-github me-1" aria-hidden="true"></i>Quellcode
        </a>
      </div>
      <p class="small text-body-secondary mt-3 mb-0">
        Dienste: Wetter und Höhen von Open-Meteo.com (CC BY 4.0) · Karten, Adresssuche und Wanderwege © OpenStreetMap-Mitwirkende (ODbL) ·
        Routenplanung BRouter · Offline-Karten Protomaps · Reise- und Sicherheitshinweise © Auswärtiges Amt (OpenData) ·
        Wechselkurse: EZB-Referenzkurse über Frankfurter.
      </p>
    </div>
  </section>
</template>
