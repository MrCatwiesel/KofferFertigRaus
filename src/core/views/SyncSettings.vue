<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOnline } from '../composables'
import { ago, generateKey, mixedContentProblem, normalizeServerUrl, pairingLink } from '../sync/logic'
import { configureSync, currentKey, disconnectSync, syncNow, syncState, testConnection } from '../sync/engine'
import { ServerClient, type ServerInfo } from '../sync/client'

const route = useRoute()
const router = useRouter()
const online = useOnline()

const server = ref('')
const key = ref('')
const showKey = ref(false)
const busy = ref(false)
const message = ref<{ type: 'success' | 'danger' | 'info'; text: string } | null>(null)
const fromLink = ref(false)
const linkCopied = ref(false)
const hostedHere = ref(false)
const serverInfo = ref<ServerInfo | null>(null)

onMounted(async () => {
  const qs = route.query
  if (typeof qs.server === 'string' && typeof qs.key === 'string') {
    // Über Kopplungs-Link geöffnet
    server.value = qs.server
    key.value = qs.key
    fromLink.value = true
    router.replace({ query: {} })
  } else if (syncState.configured) {
    server.value = syncState.server
    key.value = await currentKey()
    serverInfo.value = (await (await ServerClient.fromSync())?.info()) ?? null
  } else if (await sameOriginServer()) {
    // App kommt vom eigenen Abgleich-Server → Adresse schon eintragen
    server.value = location.origin
    hostedHere.value = true
  }
})

/** Wird die App von einem Nix-wie-weg-Abgleich-Server ausgeliefert? */
async function sameOriginServer(): Promise<boolean> {
  if (location.protocol !== 'https:' && location.hostname !== 'localhost') return false
  try {
    const r = await fetch(`${location.origin}/api/health`, { cache: 'no-store' })
    return r.ok && (await r.json()).app === 'nix-wie-weg-sync'
  } catch {
    return false
  }
}

const normalized = computed(() => normalizeServerUrl(server.value))
const mixed = computed(() => mixedContentProblem(normalized.value, location.protocol))
const keyOk = computed(() => key.value.trim().length >= 16)

async function test() {
  busy.value = true
  message.value = null
  try {
    const info = await testConnection(normalized.value, key.value.trim())
    message.value = { type: 'success', text: `Verbindung klappt. Auf dem Server liegen ${info.records} Einträge.` }
  } catch (e) {
    message.value = { type: 'danger', text: (e as Error).message }
  } finally {
    busy.value = false
  }
}

async function connect() {
  busy.value = true
  message.value = null
  try {
    await testConnection(normalized.value, key.value.trim())
    await configureSync(normalized.value, key.value.trim())
    fromLink.value = false
    message.value = syncState.lastError
      ? { type: 'danger', text: syncState.lastError }
      : { type: 'success', text: 'Eingerichtet und abgeglichen. Ab jetzt geht es automatisch.' }
  } catch (e) {
    message.value = { type: 'danger', text: (e as Error).message }
  } finally {
    busy.value = false
  }
}

async function disconnect() {
  if (!confirm('Abgleich auf diesem Gerät beenden? Die Daten auf dem Gerät bleiben erhalten.')) return
  await disconnectSync()
  key.value = ''
  message.value = { type: 'info', text: 'Abgleich beendet.' }
}

function newKey() {
  key.value = generateKey()
  showKey.value = true
}

const link = computed(() => (syncState.configured ? pairingLink(location.href, syncState.server, key.value) : ''))

async function shareLink() {
  const text = `Kopplungs-Link für „Nix wie weg“ – nur auf eigenen Geräten öffnen:\n${link.value}`
  try {
    if (navigator.share) await navigator.share({ title: 'Nix wie weg koppeln', text, url: link.value })
    else {
      await navigator.clipboard.writeText(link.value)
      linkCopied.value = true
    }
  } catch {
    /* abgebrochen */
  }
}

async function copyKey() {
  try {
    await navigator.clipboard.writeText(key.value)
    message.value = { type: 'info', text: 'Schlüssel kopiert – jetzt in der Server-Einstellung (NWW_KEYS) eintragen.' }
  } catch {
    showKey.value = true
  }
}
</script>

<template>
  <div class="mb-3">
    <RouterLink to="/einstellungen" class="small text-decoration-none"><i class="bi bi-chevron-left" aria-hidden="true"></i> Einstellungen</RouterLink>
    <h1 class="h3 mb-0 mt-1">Geräte-Abgleich</h1>
    <p class="text-body-secondary small mb-0">Alle Geräte (Handys, Tablet, PC) mit denselben Daten – über deinen eigenen Server.</p>
  </div>

  <div v-if="message" class="alert" :class="`alert-${message.type}`">{{ message.text }}</div>

  <!-- Status -->
  <div v-if="syncState.configured" class="card mb-3">
    <div class="card-body">
      <div class="d-flex align-items-center gap-3">
        <i class="bi fs-2" :class="syncState.running ? 'bi-arrow-repeat text-primary spin' : syncState.lastError ? 'bi-cloud-slash text-warning' : 'bi-cloud-check text-success'" aria-hidden="true"></i>
        <div class="flex-grow-1">
          <div class="fw-semibold">
            <template v-if="syncState.running">{{ syncState.progress || 'Gleiche ab …' }}</template>
            <template v-else-if="syncState.lastError">{{ syncState.lastError }}</template>
            <template v-else>Abgeglichen {{ ago(syncState.lastSync) }}</template>
          </div>
          <div class="small text-body-secondary">
            {{ syncState.server }}
            <template v-if="syncState.pending"> · {{ syncState.pending }} Änderungen warten</template>
          </div>
        </div>
        <button type="button" class="btn btn-outline-primary" :disabled="syncState.running || !online" @click="syncNow()">Jetzt</button>
      </div>
    </div>
  </div>

  <!-- Weitere Geräte koppeln -->
  <div v-if="syncState.configured" class="card mb-3">
    <div class="card-body">
      <h2 class="h6">Weiteres Gerät koppeln</h2>
      <p class="small text-body-secondary">
        Schick den Link per AirDrop oder Nachricht an das andere Gerät (z. B. Birgits Handy) und öffne ihn dort.
        Der Link enthält den Schlüssel – nur an eigene Geräte und Mitreisende weitergeben.
      </p>
      <button type="button" class="btn btn-primary" @click="shareLink"><i class="bi bi-share me-1" aria-hidden="true"></i>Kopplungs-Link teilen</button>
      <span v-if="linkCopied" class="small text-success ms-2">Link kopiert</span>
    </div>
  </div>

  <!-- Reisegruppen (nur Besitzer des Servers) -->
  <div v-if="syncState.configured && serverInfo?.admin" class="card mb-3">
    <div class="card-body d-flex align-items-center gap-3">
      <i class="bi bi-people fs-3 text-primary" aria-hidden="true"></i>
      <div class="flex-grow-1">
        <div class="fw-semibold">Reisegruppen</div>
        <div class="small text-body-secondary">Freunden eine eigene, getrennte Gruppe geben · Piwigo freigeben</div>
      </div>
      <RouterLink to="/gruppen" class="btn btn-outline-primary stretched-link">Verwalten</RouterLink>
    </div>
  </div>
  <div v-else-if="syncState.configured && serverInfo?.group" class="small text-body-secondary mb-3">
    <i class="bi bi-people me-1" aria-hidden="true"></i>Reisegruppe: {{ serverInfo.group }}
  </div>

  <!-- Einrichten -->
  <div class="card mb-3">
    <div class="card-body">
      <h2 class="h6">{{ syncState.configured ? 'Verbindung' : fromLink ? 'Dieses Gerät koppeln' : 'Einrichten' }}</h2>
      <p v-if="fromLink" class="small">Du hast einen Kopplungs-Link geöffnet. Tippe auf „Verbinden“, um dieses Gerät mit den anderen abzugleichen.</p>

      <div class="mb-2">
        <label for="server" class="form-label">Server-Adresse</label>
        <input id="server" v-model="server" class="form-control" placeholder="https://reise.example.de" autocomplete="off" autocapitalize="off" spellcheck="false" />
        <div v-if="mixed" class="small text-danger mt-1">
          Die App läuft über https – der Server muss auch über https erreichbar sein (siehe Anleitung).
        </div>
        <div v-if="hostedHere" class="small text-success mt-1">
          <i class="bi bi-house-check me-1" aria-hidden="true"></i>Die App kommt von deinem eigenen Server – Adresse ist schon eingetragen, nur noch den Schlüssel einfügen.
        </div>
      </div>
      <div class="mb-3">
        <label for="key" class="form-label">Schlüssel der Reisegruppe</label>
        <div class="input-group">
          <input id="key" v-model="key" :type="showKey ? 'text' : 'password'" class="form-control font-monospace" autocomplete="off" autocapitalize="off" spellcheck="false" />
          <button type="button" class="btn btn-outline-secondary" :aria-label="showKey ? 'Verbergen' : 'Anzeigen'" @click="showKey = !showKey">
            <i class="bi" :class="showKey ? 'bi-eye-slash' : 'bi-eye'" aria-hidden="true"></i>
          </button>
          <button v-if="key" type="button" class="btn btn-outline-secondary" aria-label="Kopieren" @click="copyKey"><i class="bi bi-clipboard" aria-hidden="true"></i></button>
        </div>
        <div class="form-text">
          Mindestens 16 Zeichen. Noch keinen?
          <button type="button" class="btn btn-link btn-sm p-0 align-baseline" @click="newKey">Schlüssel erzeugen</button>
          und beim Server als <code>NWW_KEYS</code> eintragen.
        </div>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <button type="button" class="btn btn-primary" :disabled="busy || !normalized || !keyOk || mixed || !online" @click="connect">
          <span v-if="busy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
          {{ syncState.configured ? 'Speichern' : 'Verbinden' }}
        </button>
        <button type="button" class="btn btn-outline-secondary" :disabled="busy || !normalized || !keyOk || !online" @click="test">Verbindung testen</button>
        <button v-if="syncState.configured" type="button" class="btn btn-outline-danger ms-auto" @click="disconnect">Abgleich beenden</button>
      </div>
      <p v-if="!online" class="small text-body-secondary mt-2 mb-0">Zum Einrichten wird Internet benötigt.</p>
    </div>
  </div>

  <details class="small mb-3">
    <summary>So funktioniert der Abgleich</summary>
    <ul class="mt-2">
      <li>Jedes Gerät merkt sich seine Änderungen – auch offline – und schickt sie, sobald Internet da ist.</li>
      <li>Abgeglichen wird beim Öffnen der App, nach Änderungen (nach wenigen Sekunden) und alle 5 Minuten.</li>
      <li>Ändern zwei Geräte denselben Eintrag, gewinnt die neuere Änderung. Löschungen werden übertragen.</li>
      <li>Fotos werden in voller Größe übertragen. Beim ersten Abgleich kann das je nach Anzahl etwas dauern.</li>
      <li>Die Daten liegen nur auf deinen Geräten und deinem Server.</li>
    </ul>
  </details>
</template>

<style scoped>
.spin {
  display: inline-block;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
