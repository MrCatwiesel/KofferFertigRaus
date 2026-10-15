<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ServerClient, type ServerError } from '../sync/client'
import { t } from '@/i18n'

/** Piwigo-Zugang des eigenen Servers (nur Besitzer): Adresse, öffentliche Adresse, API-Schlüssel. */
interface PiwigoSetup {
  configured: boolean
  source: 'app' | 'env' | 'none'
  url: string
  publicUrl: string
  keyId: string
  hasSecret: boolean
  envAvailable: boolean
  status: { user: string; admin: boolean; version: string } | null
  error: string
}

type State = 'loading' | 'no-sync' | 'not-admin' | 'old-server' | 'error' | 'ready'
const state = ref<State>('loading')
const setup = ref<PiwigoSetup | null>(null)
const form = ref({ url: '', publicUrl: '', keyId: '', secret: '' })
const busy = ref(false)
const result = ref<{ ok: boolean; text: string; detail?: string } | null>(null)
let client: ServerClient | null = null

onMounted(load)

function fill(s: PiwigoSetup) {
  setup.value = s
  form.value = { url: s.url, publicUrl: s.publicUrl, keyId: s.keyId, secret: '' }
}

async function load() {
  state.value = 'loading'
  client = await ServerClient.fromSync()
  if (!client) return (state.value = 'no-sync')
  const info = await client.info()
  if (!info) return (state.value = 'error')
  if (!info.admin || info.manager === false) return (state.value = 'not-admin')
  try {
    fill(await client.json<PiwigoSetup>('/api/admin/piwigo'))
    state.value = 'ready'
  } catch (e) {
    state.value = (e as ServerError).status === 404 ? 'old-server' : 'error'
  }
}

const canSave = computed(() => !!form.value.url.trim() && !!form.value.keyId.trim() && (!!form.value.secret.trim() || !!setup.value?.hasSecret) && !busy.value)

async function save() {
  if (!client || !canSave.value) return
  busy.value = true
  result.value = null
  try {
    const s = await client.json<PiwigoSetup>('/api/admin/piwigo', 'PUT', { ...form.value })
    fill(s)
    result.value = { ok: true, text: t('Gespeichert – verbunden als {user}.', { user: s.status?.user ?? '?' }) }
  } catch (e) {
    result.value = { ok: false, text: (e as Error).message, detail: (e as ServerError).detail }
  } finally {
    busy.value = false
  }
}

async function reset() {
  if (!client || !setup.value) return
  const question = setup.value.envAvailable
    ? t('Die hier eingetragenen Werte löschen und wieder die aus den Server-Einstellungen (sync.env) verwenden?')
    : t('Piwigo-Zugang vom Server entfernen? Hochladen und „Aus Piwigo“ gehen dann nicht mehr.')
  if (!confirm(question)) return
  busy.value = true
  result.value = null
  try {
    fill(await client.json<PiwigoSetup>('/api/admin/piwigo', 'DELETE'))
  } catch (e) {
    result.value = { ok: false, text: (e as Error).message }
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="d-flex align-items-center gap-2 mb-3">
    <RouterLink to="/abgleich" class="btn btn-sm btn-link px-0"><i class="bi bi-chevron-left" aria-hidden="true"></i>{{ t('Geräte-Abgleich') }}</RouterLink>
  </div>
  <h1 class="h3 mb-3"><i class="bi bi-images me-2 text-primary" aria-hidden="true"></i>{{ t('Piwigo-Galerie') }}</h1>

  <div v-if="state === 'loading'" class="text-center my-5"><span class="spinner-border text-primary" :aria-label="t('Lädt')"></span></div>
  <div v-else-if="state === 'no-sync'" class="alert alert-info">
    <Tx text="Piwigo läuft über deinen eigenen Abgleich-Server. Richte zuerst den {link} ein."><template #link><RouterLink to="/abgleich">{{ t('Geräte-Abgleich') }}</RouterLink></template></Tx>
  </div>
  <div v-else-if="state === 'not-admin'" class="alert alert-info">{{ t('Nur der Besitzer des Servers richtet Piwigo ein.') }}</div>
  <div v-else-if="state === 'old-server'" class="alert alert-warning" data-old-server>
    <Tx text="Dafür braucht der Server mindestens Version 1.22 – bitte im Container {cmd} ausführen.">
      <template #cmd><code>update.sh</code></template>
    </Tx>
  </div>
  <div v-else-if="state === 'error'" class="alert alert-warning d-flex align-items-center gap-2">
    <span class="flex-grow-1">{{ t('Server nicht erreichbar.') }}</span>
    <button type="button" class="btn btn-sm btn-outline-secondary" @click="load">{{ t('Erneut') }}</button>
  </div>

  <template v-else-if="setup">
    <!-- Stand -->
    <div v-if="setup.status" class="alert alert-success" data-piwigo-state="ok">
      <i class="bi bi-check-circle me-1" aria-hidden="true"></i>{{ t('Verbunden als {user}', { user: setup.status.user }) }}<template v-if="setup.status.version"> · Piwigo {{ setup.status.version }}</template>
      <div v-if="!setup.status.admin" class="small mt-1">{{ t('Hinweis: Der Schlüssel gehört keinem Administrator – Alben anlegen und Hochladen gehen dann nicht.') }}</div>
    </div>
    <div v-else-if="setup.configured" class="alert alert-warning" data-piwigo-state="error">
      <i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>{{ t('Keine Verbindung:') }} {{ setup.error }}
    </div>
    <div v-else class="alert alert-info" data-piwigo-state="none">{{ t('Noch nicht eingerichtet.') }}</div>

    <p class="small text-body-secondary">
      <template v-if="setup.source === 'env'">{{ t('Die Werte stammen aus den Server-Einstellungen (sync.env). Was du hier speicherst, gilt ab sofort vorrangig – ohne Neustart.') }}</template>
      <template v-else-if="setup.source === 'app'">{{ t('In der App eingetragen und auf dem Server gespeichert.') }}</template>
    </p>

    <form class="card mb-3" @submit.prevent="save">
      <div class="card-body">
        <div class="mb-3">
          <label for="pw-url" class="form-label">{{ t('Adresse von Piwigo') }}</label>
          <input id="pw-url" v-model="form.url" class="form-control" inputmode="url" autocomplete="off" autocapitalize="off" placeholder="http://192.168.5.15" />
          <div class="form-text">{{ t('So erreicht der Server Piwigo – meist die Adresse im Heimnetz, mit Unterordner, falls vorhanden.') }}</div>
        </div>
        <div class="mb-3">
          <label for="pw-public" class="form-label">{{ t('Öffentliche Adresse (optional)') }}</label>
          <input id="pw-public" v-model="form.publicUrl" class="form-control" inputmode="url" autocomplete="off" autocapitalize="off" placeholder="https://fotos.example.de" />
          <div class="form-text">{{ t('Für die Links „In Piwigo öffnen“ – damit sie auch unterwegs funktionieren. Leer: wie oben.') }}</div>
        </div>
        <div class="mb-3">
          <label for="pw-key" class="form-label">{{ t('API-Schlüssel: ID') }}</label>
          <input id="pw-key" v-model="form.keyId" class="form-control font-monospace" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="pkid-20261015-…" />
        </div>
        <div class="mb-3">
          <label for="pw-secret" class="form-label">{{ t('API-Schlüssel: Geheimnis') }}</label>
          <input id="pw-secret" v-model="form.secret" type="password" class="form-control font-monospace" autocomplete="new-password" :placeholder="setup.hasSecret ? t('unverändert lassen') : ''" />
          <div class="form-text">{{ t('In Piwigo als Administrator: Profil → API-Schlüssel → neuer Schlüssel. Das Geheimnis zeigt Piwigo nur einmal; der Server gibt es nie wieder heraus.') }}</div>
        </div>
        <div v-if="result" class="alert py-2 small" :class="result.ok ? 'alert-success' : 'alert-danger'" data-piwigo-result>
          {{ result.text }}<div v-if="result.detail" class="mt-1 text-body-secondary">{{ result.detail }}</div>
        </div>
        <div class="d-flex flex-wrap gap-2">
          <button type="submit" class="btn btn-primary" :disabled="!canSave" data-piwigo-save>
            <span v-if="busy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>{{ t('Prüfen und speichern') }}
          </button>
          <button v-if="setup.source === 'app'" type="button" class="btn btn-outline-secondary" :disabled="busy" data-piwigo-reset @click="reset">
            {{ setup.envAvailable ? t('Zurück zu den Server-Einstellungen') : t('Piwigo-Zugang entfernen') }}
          </button>
        </div>
        <div class="form-text mt-2">{{ t('Gespeichert wird erst, wenn die Anmeldung bei Piwigo klappt.') }}</div>
      </div>
    </form>

    <p class="small text-body-secondary">
      <Tx text="Welche Reisegruppen Piwigo nutzen dürfen, legst du unter {link} fest.">
        <template #link><RouterLink to="/gruppen">{{ t('Reisegruppen') }}</RouterLink></template>
      </Tx>
    </p>
  </template>
</template>
