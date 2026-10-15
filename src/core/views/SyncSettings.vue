<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useOnline } from '../composables'
import { ago, generateKey, isInviteCode, mixedContentProblem, normalizeServerUrl, pairingLink } from '../sync/logic'
import { configureSync, currentKey, disconnectSync, logoutThisDevice, suggestedDeviceName, syncNow, syncState, testConnection } from '../sync/engine'
import { ServerClient, type ServerInfo } from '../sync/client'
import { LoginError, checkInvite } from '../sync/api'
import { ROLE_LABEL, people } from '../people'
import { pushState } from '../push'
import DevicesCard from './DevicesCard.vue'
import { t } from '@/i18n'

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
const deviceName = ref(suggestedDeviceName())
/** Anmelden: mit Einladung/Schlüssel oder als Person mit Name + Passwort */
const mode = ref<'code' | 'passwort'>('code')
const login = ref('')
const password = ref('')
const password2 = ref('')
/** Einladung für eine Person, die ein Passwort festlegen muss */
const invitePerson = ref<{ person: string; needsPassword: boolean } | null>(null)
const pwChange = ref({ open: false, old: '', pw: '', pw2: '' })
watch(key, () => (invitePerson.value = null))
/** Mit eigenem Gerätezugang angemeldet (und nicht abgemeldet) → Schlüsselfeld nicht nötig */
const deviceLogin = computed(() => syncState.configured && !!syncState.device && !syncState.revoked)

onMounted(async () => {
  const qs = route.query
  if (typeof qs.server === 'string' && (typeof qs.key === 'string' || typeof qs.code === 'string')) {
    // Über Einladung (code) oder älteren Kopplungs-Link (key) geöffnet
    server.value = qs.server
    key.value = typeof qs.code === 'string' ? qs.code : String(qs.key)
    fromLink.value = true
    router.replace({ query: {} })
  } else if (syncState.configured && !syncState.revoked) {
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
    return r.ok && ['koffer-fertig-raus-sync', 'nix-wie-weg-sync'].includes((await r.json()).app) // alter Name bei älteren Servern
  } catch {
    return false
  }
}

const normalized = computed(() => normalizeServerUrl(server.value))
const mixed = computed(() => mixedContentProblem(normalized.value, location.protocol))
const isCode = computed(() => isInviteCode(key.value))
const keyOk = computed(() => isCode.value || key.value.trim().length >= 16)
const pwMismatch = computed(() => !!password2.value && password.value !== password2.value)
const canConnect = computed(() => {
  if (!normalized.value || mixed.value || !online.value) return false
  if (mode.value === 'passwort') return !!login.value.trim() && !!password.value
  if (invitePerson.value?.needsPassword) return password.value.length >= 8 && password.value === password2.value
  return keyOk.value
})

async function test() {
  busy.value = true
  message.value = null
  try {
    const info = await testConnection(normalized.value, key.value.trim())
    message.value = { type: 'success', text: t('Verbindung klappt. Auf dem Server liegen {records} Einträge.', { records: info.records }) }
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
    const name = deviceName.value.trim() || suggestedDeviceName()
    if (mode.value === 'passwort') {
      await configureSync(normalized.value, '', name, { login: login.value.trim(), password: password.value })
    } else {
      if (!isCode.value) await testConnection(normalized.value, key.value.trim())
      // Einladung für eine Person: erst fragen, ob ein Passwort festgelegt werden muss
      if (isCode.value && !invitePerson.value) {
        const c = await checkInvite(normalized.value, key.value.trim().toUpperCase().replace(/[\s-]/g, ''))
        if (c?.person) invitePerson.value = { person: c.person, needsPassword: c.needsPassword }
        if (c?.needsPassword) {
          message.value = { type: 'info', text: t('Einladung für {person} ({group}). Leg jetzt dein Passwort fest – damit meldest du später weitere Geräte an.', { person: c.person, group: c.group }) }
          return
        }
      }
      await configureSync(normalized.value, key.value.trim(), name, { password: invitePerson.value?.needsPassword ? password.value : undefined })
    }
    password.value = password2.value = ''
    invitePerson.value = null
    fromLink.value = false
    key.value = syncState.device ? '' : key.value
    serverInfo.value = (await (await ServerClient.fromSync())?.info()) ?? null
    message.value = syncState.lastError
      ? { type: 'danger', text: syncState.lastError }
      : { type: 'success', text: t('Eingerichtet und abgeglichen. Ab jetzt geht es automatisch.') }
  } catch (e) {
    message.value = { type: 'danger', text: (e as Error).message }
    if (e instanceof LoginError && e.code === 'passwort' && invitePerson.value) invitePerson.value.needsPassword = true
  } finally {
    busy.value = false
  }
}

async function changePassword() {
  const c = await ServerClient.fromSync()
  if (!c) return
  try {
    await c.json('/api/personen/ich', 'PATCH', { oldPassword: pwChange.value.old, password: pwChange.value.pw })
    pwChange.value = { open: false, old: '', pw: '', pw2: '' }
    message.value = { type: 'success', text: t('Passwort geändert.') }
  } catch (e) {
    message.value = { type: 'danger', text: (e as Error).message }
  }
}

async function disconnect() {
  if (!confirm(t('Abgleich auf diesem Gerät beenden? Die Daten auf dem Gerät bleiben erhalten.'))) return
  if (syncState.device) await logoutThisDevice()
  else await disconnectSync()
  serverInfo.value = null
  key.value = ''
  message.value = { type: 'info', text: t('Abgleich beendet.') }
}

function onLoggedOut() {
  key.value = ''
  serverInfo.value = null
  message.value = { type: 'info', text: t('Dieses Gerät ist abgemeldet. Die Daten auf dem Gerät bleiben erhalten.') }
}

function newKey() {
  key.value = generateKey()
  showKey.value = true
}

const link = computed(() => (syncState.configured ? pairingLink(location.href, syncState.server, key.value) : ''))

async function shareLink() {
  const text = t('Kopplungs-Link für „KofferFertigRaus“ – nur auf eigenen Geräten öffnen:\n{value}', { value: link.value })
  try {
    if (navigator.share) await navigator.share({ title: t('KofferFertigRaus koppeln'), text, url: link.value })
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
    message.value = { type: 'info', text: t('Schlüssel kopiert – jetzt in der Server-Einstellung (NWW_KEYS) eintragen.') }
  } catch {
    showKey.value = true
  }
}
</script>

<template>
  <div class="mb-3">
    <RouterLink to="/einstellungen" class="small text-decoration-none"><i class="bi bi-chevron-left" aria-hidden="true"></i> {{ t('Einstellungen') }}</RouterLink>
    <h1 class="h3 mb-0 mt-1">{{ t('Geräte-Abgleich') }}</h1>
    <p class="text-body-secondary small mb-0">{{ t('Alle Geräte (Handys, Tablet, PC) mit denselben Daten – über deinen eigenen Server.') }}</p>
  </div>

  <div v-if="message" class="alert" :class="`alert-${message.type}`">{{ message.text }}</div>
  <div v-if="syncState.revoked" class="alert alert-warning">
    <i class="bi bi-person-x me-1" aria-hidden="true"></i>{{ syncState.revoked }}
  </div>

  <!-- Status -->
  <div v-if="syncState.configured" class="card mb-3">
    <div class="card-body">
      <div class="d-flex align-items-center gap-3">
        <i class="bi fs-2" :class="syncState.running ? 'bi-arrow-repeat text-primary spin' : syncState.lastError ? 'bi-cloud-slash text-warning' : 'bi-cloud-check text-success'" aria-hidden="true"></i>
        <div class="flex-grow-1">
          <div class="fw-semibold">
            <template v-if="syncState.running">{{ syncState.progress || t('Gleiche ab …') }}</template>
            <template v-else-if="syncState.lastError">{{ syncState.lastError }}</template>
            <template v-else>{{ t('Abgeglichen {ago}', { ago: ago(syncState.lastSync) }) }}</template>
          </div>
          <div class="small text-body-secondary">
            {{ syncState.server }}
            <template v-if="syncState.pending"> {{ t('· {pending} Änderungen warten', { pending: syncState.pending }) }}</template>
          </div>
        </div>
        <button type="button" class="btn btn-outline-primary" :disabled="syncState.running || !online" @click="syncNow()">{{ t('Jetzt') }}</button>
      </div>
      <div v-if="syncState.warnings.length" class="alert alert-warning small py-2 mt-3 mb-0">
        <div class="fw-semibold mb-1"><i class="bi bi-exclamation-triangle me-1" aria-hidden="true"></i>{{ t('Nicht alles konnte abgeglichen werden – der Rest läuft normal weiter:') }}</div>
        <ul class="mb-1 ps-3"><li v-for="w in syncState.warnings" :key="w">{{ w }}</li></ul>
        <button type="button" class="btn btn-link btn-sm p-0" @click="syncState.warnings = []">{{ t('Hinweise ausblenden') }}</button>
      </div>
    </div>
  </div>

  <!-- Geräte (eigener Zugang je Gerät) -->
  <DevicesCard v-if="deviceLogin" @logged-out="onLoggedOut" />

  <!-- Weitere Geräte koppeln (ältere Server ohne Gerätezugänge) -->
  <div v-else-if="syncState.configured && !syncState.revoked && serverInfo && !serverInfo.devices" class="card mb-3">
    <div class="card-body">
      <h2 class="h6">{{ t('Weiteres Gerät koppeln') }}</h2>
      <p class="small text-body-secondary">
        {{ t('Schick den Link per AirDrop oder Nachricht an das andere Gerät (z. B. Birgits Handy) und öffne ihn dort. Der Link enthält den Schlüssel – nur an eigene Geräte und Mitreisende weitergeben.') }}
      </p>
      <button type="button" class="btn btn-primary" @click="shareLink"><i class="bi bi-share me-1" aria-hidden="true"></i>{{ t('Kopplungs-Link teilen') }}</button>
      <span v-if="linkCopied" class="small text-success ms-2">{{ t('Link kopiert') }}</span>
    </div>
  </div>

  <!-- Personen & Rechte (Server 1.16) -->
  <div v-if="syncState.configured && !syncState.revoked && people.enabled" class="card mb-3" data-people-card>
    <div class="card-body">
      <div class="d-flex align-items-center gap-3">
        <i class="bi bi-person-lock fs-3 text-primary" aria-hidden="true"></i>
        <div class="flex-grow-1">
          <div class="fw-semibold">
            <template v-if="people.me">{{ t('Angemeldet als {name}', { name: people.me.name }) }} <span class="badge text-bg-secondary fw-normal">{{ ROLE_LABEL[people.me.role] }}</span></template>
            <template v-else>{{ t('Personen & Rechte') }}</template>
          </div>
          <div class="small text-body-secondary">
            <template v-if="people.manager">{{ t('Personen einladen, Rollen und Zugriff je Reise festlegen') }}</template>
            <template v-else>{{ t('Deine privaten Einträge (Packliste, Medikamente, Dokumente) sieht nur du.') }}</template>
          </div>
        </div>
        <RouterLink v-if="people.manager" to="/personen" class="btn btn-outline-primary">{{ t('Verwalten') }}</RouterLink>
      </div>
      <div v-if="people.me" class="mt-2">
        <button v-if="!pwChange.open" type="button" class="btn btn-link btn-sm p-0" @click="pwChange.open = true">{{ t('Passwort ändern') }}</button>
        <form v-else class="row g-2 mt-1" @submit.prevent="changePassword">
          <div class="col-12 col-md-4"><input v-model="pwChange.old" type="password" class="form-control form-control-sm" :placeholder="t('Bisheriges Passwort')" autocomplete="current-password" :aria-label="t('Bisheriges Passwort')" /></div>
          <div class="col-6 col-md-3"><input v-model="pwChange.pw" type="password" class="form-control form-control-sm" :placeholder="t('Neues Passwort')" autocomplete="new-password" :aria-label="t('Neues Passwort')" /></div>
          <div class="col-6 col-md-3"><input v-model="pwChange.pw2" type="password" class="form-control form-control-sm" :placeholder="t('Wiederholen')" autocomplete="new-password" :aria-label="t('Neues Passwort wiederholen')" /></div>
          <div class="col-12 col-md-2"><button type="submit" class="btn btn-primary btn-sm w-100" :disabled="pwChange.pw.length < 8 || pwChange.pw !== pwChange.pw2">{{ t('Ändern') }}</button></div>
        </form>
      </div>
    </div>
  </div>

  <!-- Benachrichtigungen (Server 1.17) -->
  <div v-if="syncState.configured && !syncState.revoked" class="card mb-3" data-push-link>
    <div class="card-body d-flex align-items-center gap-3">
      <i class="bi fs-3 text-primary" :class="pushState.active ? 'bi-bell-fill' : 'bi-bell'" aria-hidden="true"></i>
      <div class="flex-grow-1">
        <div class="fw-semibold">{{ t('Benachrichtigungen') }}</div>
        <div class="small text-body-secondary">{{ pushState.active ? t('Auf diesem Gerät eingeschaltet') : t('Erinnerungen an Fristen und Termine aufs Gerät') }}</div>
      </div>
      <RouterLink to="/benachrichtigungen" class="btn btn-outline-primary stretched-link">{{ pushState.active ? t('Ändern') : t('Einrichten') }}</RouterLink>
    </div>
  </div>

  <!-- Reisegruppen (nur Besitzer des Servers) -->
  <div v-if="syncState.configured && serverInfo?.admin" class="card mb-3">
    <div class="card-body d-flex align-items-center gap-3">
      <i class="bi bi-people fs-3 text-primary" aria-hidden="true"></i>
      <div class="flex-grow-1">
        <div class="fw-semibold">{{ t('Reisegruppen') }}</div>
        <div class="small text-body-secondary">{{ t('Freunden eine eigene, getrennte Gruppe geben · Piwigo freigeben') }}</div>
      </div>
      <RouterLink to="/gruppen" class="btn btn-outline-primary stretched-link">{{ t('Verwalten') }}</RouterLink>
    </div>
  </div>
  <div v-else-if="syncState.configured && serverInfo?.group" class="small text-body-secondary mb-3">
    <i class="bi bi-people me-1" aria-hidden="true"></i>{{ t('Reisegruppe: {group}', { group: serverInfo.group }) }}
  </div>
  <div v-if="syncState.configured && serverInfo?.admin" class="card mb-3">
    <div class="card-body d-flex align-items-center gap-3">
      <i class="bi bi-archive fs-3 text-primary" aria-hidden="true"></i>
      <div class="flex-grow-1">
        <div class="fw-semibold">{{ t('Server-Sicherung') }}</div>
        <div class="small text-body-secondary">{{ t('Weitere Sicherungsziele: Platte, SMB-Freigabe, SSH/rsync, WebDAV') }}</div>
      </div>
      <RouterLink to="/sicherung" class="btn btn-outline-primary stretched-link">{{ t('Verwalten') }}</RouterLink>
    </div>
  </div>

  <!-- Einrichten -->
  <div class="card mb-3">
    <div class="card-body">
      <h2 class="h6">{{ deviceLogin ? t('Verbindung') : fromLink ? t('Dieses Gerät verbinden') : t('Einrichten') }}</h2>
      <p v-if="fromLink" class="small">{{ t('Du hast eine Einladung geöffnet. Gib dem Gerät einen Namen und tippe auf „Verbinden“.') }}</p>

      <template v-if="deviceLogin">
        <p class="small mb-3">
          {{ t('Verbunden mit') }} <strong>{{ syncState.server }}</strong> {{ t('als') }} <strong>{{ syncState.device?.name }}</strong> {{ t('– mit eigenem Gerätezugang. Ein Schlüssel muss hier nicht mehr eingegeben werden.') }}
        </p>
        <button type="button" class="btn btn-outline-danger" @click="disconnect">{{ t('Dieses Gerät abmelden') }}</button>
      </template>
      <template v-else>

      <div class="btn-group btn-group-sm mb-3" role="group" :aria-label="t('Anmelden mit')">
        <input id="mode-code" v-model="mode" type="radio" class="btn-check" value="code" />
        <label class="btn btn-outline-primary" for="mode-code">{{ t('Einladung oder Schlüssel') }}</label>
        <input id="mode-pw" v-model="mode" type="radio" class="btn-check" value="passwort" />
        <label class="btn btn-outline-primary" for="mode-pw">{{ t('Name und Passwort') }}</label>
      </div>

      <div class="mb-2">
        <label for="server" class="form-label">{{ t('Server-Adresse') }}</label>
        <input id="server" v-model="server" class="form-control" :placeholder="t('https://reise.example.de')" autocomplete="off" autocapitalize="off" spellcheck="false" />
        <div v-if="mixed" class="small text-danger mt-1">
          {{ t('Die App läuft über https – der Server muss auch über https erreichbar sein (siehe Anleitung).') }}
        </div>
        <div v-if="hostedHere" class="small text-success mt-1">
          <i class="bi bi-house-check me-1" aria-hidden="true"></i>{{ t('Die App kommt von deinem eigenen Server – Adresse ist schon eingetragen, nur noch den Schlüssel einfügen.') }}
        </div>
      </div>
      <div v-if="mode === 'passwort'" class="row g-2 mb-3">
        <div class="col-12 col-md-6">
          <label for="login" class="form-label">{{ t('Dein Name') }}</label>
          <input id="login" v-model="login" class="form-control" autocomplete="username" autocapitalize="words" />
        </div>
        <div class="col-12 col-md-6">
          <label for="login-pw" class="form-label">{{ t('Passwort') }}</label>
          <input id="login-pw" v-model="password" type="password" class="form-control" autocomplete="current-password" />
        </div>
        <div class="col-12 form-text mt-1">{{ t('Für Personen, die schon eingeladen wurden und ein Passwort festgelegt haben.') }}</div>
      </div>
      <div v-else class="mb-3">
        <label for="key" class="form-label">{{ t('Einladungscode oder Schlüssel der Reisegruppe') }}</label>
        <div class="input-group">
          <input id="key" v-model="key" :type="showKey ? 'text' : 'password'" class="form-control font-monospace" autocomplete="off" autocapitalize="off" spellcheck="false" />
          <button type="button" class="btn btn-outline-secondary" :aria-label="showKey ? t('Verbergen') : t('Anzeigen')" @click="showKey = !showKey">
            <i class="bi" :class="showKey ? 'bi-eye-slash' : 'bi-eye'" aria-hidden="true"></i>
          </button>
          <button v-if="key" type="button" class="btn btn-outline-secondary" :aria-label="t('Kopieren')" @click="copyKey"><i class="bi bi-clipboard" aria-hidden="true"></i></button>
        </div>
        <div v-if="isCode" class="form-text text-success"><i class="bi bi-check-circle me-1" aria-hidden="true"></i>{{ t('Einladungscode erkannt – gilt einmal.') }}</div>
        <div v-else class="form-text">
          <Tx text="Einladungscode (z. B. {example}) von einem anderen Gerät – oder den Schlüssel der Reisegruppe. Noch keinen? {button} und beim Server als {setting} eintragen.">
            <template #example><code>ABCD-EFGH-JKLM</code></template>
            <template #button><button type="button" class="btn btn-link btn-sm p-0 align-baseline" @click="newKey">{{ t('Schlüssel erzeugen') }}</button></template>
            <template #setting><code>NWW_KEYS</code></template>
          </Tx>
        </div>
        <div v-if="invitePerson?.needsPassword" class="row g-2 mt-2" data-new-password>
          <div class="col-12 small fw-semibold">{{ t('Passwort für {person} festlegen', { person: invitePerson.person }) }}</div>
          <div class="col-6">
            <input v-model="password" type="password" class="form-control" :placeholder="t('Passwort')" autocomplete="new-password" :aria-label="t('Neues Passwort')" />
          </div>
          <div class="col-6">
            <input v-model="password2" type="password" class="form-control" :placeholder="t('Wiederholen')" autocomplete="new-password" :aria-label="t('Passwort wiederholen')" />
          </div>
          <div class="col-12 form-text mt-0">{{ t('Mindestens 8 Zeichen.') }}<span v-if="pwMismatch" class="text-danger"> {{ t('Die Passwörter stimmen nicht überein.') }}</span></div>
        </div>
      </div>
      <div class="mb-3">
        <label for="devname" class="form-label">{{ t('Name dieses Geräts') }}</label>
        <input id="devname" v-model="deviceName" class="form-control" maxlength="60" :placeholder="t('z. B. iPad Marco')" />
        <div class="form-text">{{ t('So erscheint das Gerät in der Geräteliste – dort kannst du es auch wieder abmelden.') }}</div>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <button type="button" class="btn btn-primary" :disabled="busy || !canConnect" @click="connect">
          <span v-if="busy" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
          {{ syncState.configured ? t('Speichern') : t('Verbinden') }}
        </button>
        <button v-if="mode === 'code'" type="button" class="btn btn-outline-secondary" :disabled="busy || !normalized || !keyOk || isCode || !online" @click="test">{{ t('Verbindung testen') }}</button>
        <button v-if="syncState.configured" type="button" class="btn btn-outline-danger ms-auto" @click="disconnect">{{ t('Abgleich beenden') }}</button>
      </div>
      <p v-if="!online" class="small text-body-secondary mt-2 mb-0">{{ t('Zum Einrichten wird Internet benötigt.') }}</p>
      </template>
    </div>
  </div>

  <details class="small mb-3">
    <summary>{{ t('So funktioniert der Abgleich') }}</summary>
    <ul class="mt-2">
      <li>{{ t('Jedes Gerät merkt sich seine Änderungen – auch offline – und schickt sie, sobald Internet da ist.') }}</li>
      <li>{{ t('Abgeglichen wird beim Öffnen der App, nach Änderungen (nach wenigen Sekunden) und alle 5 Minuten.') }}</li>
      <li>{{ t('Ändern zwei Geräte denselben Eintrag, gewinnt die neuere Änderung. Löschungen werden übertragen.') }}</li>
      <li>{{ t('Fotos werden in voller Größe übertragen. Beim ersten Abgleich kann das je nach Anzahl etwas dauern.') }}</li>
      <li>{{ t('Die Daten liegen nur auf deinen Geräten und deinem Server.') }}</li>
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
