<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { downloadBlob, exportBackup, importBackup } from '../backup'
import { formatBytes, requestPersistentStorage, storageInfo, type StorageInfo } from '../storage'
import { describeStats } from '../merge'
import { APP_CONFIG, APP_VERSION } from '@/config'
import AppLogo from '@/ui/AppLogo.vue'
import { appearance } from '@/ui/appearance'
import { getTheme } from '@/ui/themes'
import { lock } from '../lock'
import { ENGLISH_COMPLETE, lang, langSetting, setLang, t, type LangSetting } from '@/core/i18n'
import { updatePushLang } from '../push'

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
    downloadBlob(blob, `nix-wie-weg-backup-${exportedAt.slice(0, 10)}${suffix}.json`)
    message.value = { type: 'success', text: t('Backup wurde heruntergeladen ({0}).', [formatBytes(blob.size)]) }
  } catch (err) {
    message.value = { type: 'danger', text: t('Export fehlgeschlagen: {0}', [(err as Error).message]) }
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
      const what = result.meta.scope ? t('Reise „{0}“', [result.meta.scope.title]) : t('Backup')
      message.value = { type: 'success', text: t('{0} eingelesen: {1}.', [what, describeStats(result.stats)]) }
    }
    await refreshStorage()
  } catch (err) {
    message.value = { type: 'danger', text: t('Import fehlgeschlagen: {0}', [(err as Error).message]) }
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

// Sprache (gilt für dieses Gerät)
const langChoice = ref<LangSetting>(langSetting())
const changeLang = () => void setLang(langChoice.value).then(() => updatePushLang())
</script>

<template>
  <div class="d-flex align-items-center justify-content-between gap-2 mb-3">
    <h1 class="h3 mb-0">{{ $t('Einstellungen') }}</h1>
    <a v-if="APP_CONFIG.donationUrl" :href="APP_CONFIG.donationUrl" target="_blank" rel="noopener" class="btn btn-sm btn-outline-danger" data-donate>
      <i class="bi bi-heart-fill me-1" aria-hidden="true"></i>{{ $t('Unterstützen') }}
    </a>
  </div>

  <div v-if="message" class="alert" :class="`alert-${message.type}`">{{ message.text }}</div>

  <RouterLink to="/einstellungen/aussehen" class="card mb-3 text-decoration-none text-body">
    <div class="card-body d-flex align-items-center gap-3">
      <AppLogo :size="40" />
      <div class="flex-grow-1">
        <div class="h5 mb-0">{{ $t('Aussehen') }}</div>
        <div class="small text-body-secondary">{{ $t('Design „{0}“ · Hintergrund · Schrift · Reiseseite anpassen', [getTheme(appearance.theme).label]) }}</div>
      </div>
      <i class="bi bi-chevron-right text-body-secondary" aria-hidden="true"></i>
    </div>
  </RouterLink>

  <RouterLink to="/einstellungen/sperre" class="card mb-3 text-decoration-none text-body">
    <div class="card-body d-flex align-items-center gap-3">
      <i class="bi fs-3" :class="lock.enabled ? 'bi-shield-lock-fill text-success' : 'bi-shield-lock text-primary'" aria-hidden="true"></i>
      <div class="flex-grow-1">
        <div class="h5 mb-0">{{ $t('App-Sperre') }}</div>
        <div class="small text-body-secondary">{{ lock.enabled ? `An${lock.biometric ? ' · mit Face ID / Touch ID' : ''}` : $t('Aus – mit Code oder Face ID schützen') }}</div>
      </div>
      <i class="bi bi-chevron-right text-body-secondary" aria-hidden="true"></i>
    </div>
  </RouterLink>

  <section class="card mb-3" data-settings-lang>
    <div class="card-body d-flex flex-wrap align-items-center gap-3">
      <i class="bi bi-translate fs-3 text-primary" aria-hidden="true"></i>
      <div class="flex-grow-1">
        <label for="app-lang" class="h5 mb-1 d-block">{{ $t('Sprache') }} · Language</label>
        <select id="app-lang" v-model="langChoice" class="form-select form-select-sm w-auto" @change="changeLang">
          <option value="auto">{{ $t('Wie das Gerät') }}</option>
          <option value="de">Deutsch</option>
          <option value="en">English</option>
        </select>
        <div v-if="lang === 'en' && !ENGLISH_COMPLETE" class="small text-body-secondary mt-1">{{ $t('Englisch ist noch in Arbeit – einzelne Texte erscheinen noch auf Deutsch.') }}</div>
      </div>
    </div>
  </section>

  <RouterLink to="/hilfe" class="card mb-3 text-decoration-none text-body" data-settings-help>
    <div class="card-body d-flex align-items-center gap-3">
      <i class="bi bi-question-circle fs-3 text-primary" aria-hidden="true"></i>
      <div class="flex-grow-1">
        <div class="h5 mb-0">{{ $t('Hilfe & Einführung') }}</div>
        <div class="small text-body-secondary">{{ $t('Alles kurz erklärt, mit Suche – und die Einführung zum Durchtippen') }}</div>
      </div>
      <i class="bi bi-chevron-right text-body-secondary" aria-hidden="true"></i>
    </div>
  </RouterLink>

  <RouterLink to="/abgleich" class="card mb-3 text-decoration-none text-body">
    <div class="card-body d-flex align-items-center gap-3">
      <i class="bi bi-cloud-arrow-up-fill fs-3 text-primary" aria-hidden="true"></i>
      <div class="flex-grow-1">
        <div class="h5 mb-0">{{ $t('Geräte-Abgleich') }}</div>
        <div class="small text-body-secondary">{{ $t('Handys, Tablet und PC automatisch auf demselben Stand halten') }}</div>
      </div>
      <i class="bi bi-chevron-right text-body-secondary" aria-hidden="true"></i>
    </div>
  </RouterLink>

  <section class="card mb-3">
    <div class="card-body">
      <h2 class="h5">{{ $t('Datensicherung') }}</h2>
      <p class="text-body-secondary small">
        {{ $t('Alle Daten liegen nur auf diesem Gerät. Sichere sie regelmäßig als Datei – damit kannst du sie auch auf ein anderes Gerät übertragen. Beim Einlesen wird zusammengeführt: Neues kommt dazu, bei Unterschieden gewinnt die neuere Änderung.') }}
      </p>
      <div class="form-check form-switch mb-2">
        <input id="photos" v-model="includePhotos" class="form-check-input" type="checkbox" role="switch" />
        <label class="form-check-label" for="photos">{{ $t('Fotos mitsichern (Datei wird deutlich größer)') }}</label>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <button class="btn btn-outline-primary" :disabled="busy" @click="doExport">
          <span v-if="busy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
          <i v-else class="bi bi-download me-1" aria-hidden="true"></i>{{ $t('Backup exportieren') }}
        </button>
        <label class="btn btn-outline-secondary mb-0" :class="{ disabled: busy }">
          <i class="bi bi-upload me-1" aria-hidden="true"></i>{{ $t('Backup oder geteilte Reise einlesen') }}
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

  <section class="card mb-3">
    <div class="card-body">
      <h2 class="h5">{{ $t('Speicher') }}</h2>
      <p v-if="storage?.usedBytes != null" class="small mb-1">
        {{ $t('Belegt:') }} <strong>{{ formatBytes(storage.usedBytes) }}</strong>
        <template v-if="storage.quotaBytes"> {{ $t('von ca. {0} verfügbar', [formatBytes(storage.quotaBytes)]) }}</template>
      </p>
      <p class="small mb-2">
        <template v-if="storage?.persisted">
          <i class="bi bi-shield-check text-success me-1" aria-hidden="true"></i>{{ $t('Daten werden dauerhaft behalten.') }}
        </template>
        <template v-else>
          <i class="bi bi-exclamation-triangle text-warning me-1" aria-hidden="true"></i>
          {{ $t('Der Browser darf die Daten bei Platzmangel löschen. Regelmäßig sichern!') }}
        </template>
      </p>
      <button v-if="!storage?.persisted" type="button" class="btn btn-sm btn-outline-primary" @click="persist">
        {{ $t('Dauerhaft speichern anfragen') }}
      </button>
    </div>
  </section>

  <section class="card">
    <div class="card-body">
      <h2 class="h5">{{ $t('Über „{0}“', [APP_CONFIG.name]) }}</h2>
      <p class="small text-body-secondary">
        {{ $t('Version {0} · Freie Software unter der', [APP_VERSION]) }} <a :href="APP_CONFIG.licenseUrl" target="_blank" rel="noopener">{{ APP_CONFIG.license }}</a>{{ $t(', entwickelt in der Freizeit. Kostenlos, ohne Werbung, ohne Konto – deine Daten bleiben auf deinen Geräten bzw. deinem eigenen Server.') }}
      </p>
      <div class="d-flex flex-wrap gap-2">
        <a v-if="APP_CONFIG.donationUrl" :href="APP_CONFIG.donationUrl" target="_blank" rel="noopener" class="btn btn-sm btn-outline-danger">
          <i class="bi bi-heart-fill me-1" aria-hidden="true"></i>{{ $t('Über {0} unterstützen', [APP_CONFIG.donationLabel]) }}
        </a>
        <a :href="APP_CONFIG.repositoryUrl" target="_blank" rel="noopener" class="btn btn-sm btn-outline-secondary">
          <i class="bi bi-github me-1" aria-hidden="true"></i>{{ $t('Quellcode') }}
        </a>
      </div>
      <p class="small text-body-secondary mt-3 mb-0">
        {{ $t('Dienste: Wetter und Höhen von Open-Meteo.com (CC BY 4.0) · Karten, Adresssuche und Wanderwege © OpenStreetMap-Mitwirkende (ODbL) · Routenplanung BRouter · Offline-Karten Protomaps · Reise- und Sicherheitshinweise © Auswärtiges Amt (OpenData) · Unwetterwarnungen MeteoAlarm (EUMETNET) · Wechselkurse: EZB-Referenzkurse über Frankfurter.') }}
      </p>
    </div>
  </section>
</template>
