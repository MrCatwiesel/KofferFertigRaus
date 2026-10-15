<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref, shallowRef } from 'vue'
import { ServerClient } from '../sync/client'
import { ago } from '../sync/logic'
import { t } from '@/i18n'

type TargetType = 'ordner' | 'smb' | 'ssh' | 'webdav'
interface Target {
  id?: string
  name: string
  type: TargetType
  enabled: boolean
  keep: number
  path?: string
  host?: string
  share?: string
  user?: string
  domain?: string
  port?: number
  url?: string
  password?: string
  hasPassword?: boolean
}
interface Result {
  at: string
  ok: boolean
  message: string
  test?: boolean
}
interface Status {
  running?: boolean
  started?: string
  finished?: string
  local?: { at: string; path: string; size: string }
  targets: Record<string, Result & { lastTest?: Result }>
}

const TYPE_INFO: Record<TargetType, { label: string; icon: string; hint: string }> = {
  ordner: { label: t('Ordner / Platte'), icon: 'device-hdd', hint: t('Eingehängte USB-Platte oder eine in Proxmox eingebundene SMB-/NFS-Freigabe') },
  smb: { label: 'SMB-Freigabe', icon: 'hdd-network', hint: t('Windows-Freigabe, Synology, QNAP, FRITZ!Box-NAS – direkt, ohne Einhängen') },
  ssh: { label: 'SSH / rsync', icon: 'terminal', hint: t('Anderer Linux-Rechner oder NAS mit SSH – überträgt nur Änderungen') },
  webdav: { label: 'WebDAV', icon: 'cloud-upload', hint: 'Nextcloud, ownCloud, Synology WebDAV, Hetzner Storage Box' }
}

const client = shallowRef<ServerClient | null>(null)
const targets = ref<Target[]>([])
const status = ref<Status | null>(null)
const installed = ref(true)
const pending = ref(false)
const sshKey = ref('')
const loading = ref(true)
const error = ref('')
const info = ref('')
const editing = ref<Target | null>(null)
const editIndex = ref(-1)
const saving = ref(false)
let poll: ReturnType<typeof setInterval> | undefined

async function load() {
  client.value = await ServerClient.fromSync()
  if (!client.value) {
    error.value = t('Der Geräte-Abgleich ist nicht eingerichtet.')
    loading.value = false
    return
  }
  try {
    const r = await client.value.json<{ targets: Target[]; status: Status | null; pending: boolean; sshPublicKey: string; installed: boolean }>('/api/admin/sicherung')
    targets.value = r.targets
    status.value = r.status
    pending.value = r.pending
    sshKey.value = r.sshPublicKey
    installed.value = r.installed
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

/** Während eine Sicherung läuft oder angestoßen ist: alle 3 s nachsehen */
function watchRun() {
  clearInterval(poll)
  let rounds = 0
  poll = setInterval(async () => {
    await load()
    if ((!pending.value && !status.value?.running) || ++rounds > 200) {
      clearInterval(poll)
      info.value = t('Fertig – das Ergebnis steht bei den Zielen.')
    }
  }, 3000)
}

onMounted(async () => {
  await load()
  if (pending.value || status.value?.running) watchRun()
})
onUnmounted(() => clearInterval(poll))

async function start(target: Target | null, test: boolean) {
  if (!client.value) return
  error.value = ''
  info.value = test ? t('Teste „{name}“ …', { name: target?.name }) : t('Sicherung angestoßen – das kann je nach Fotomenge einige Minuten dauern.')
  try {
    await client.value.json('/api/admin/sicherung/jetzt', 'POST', { test, target: target?.id ?? null })
    pending.value = true
    watchRun()
  } catch (e) {
    error.value = (e as Error).message
  }
}

function blank(type: TargetType): Target {
  return { name: TYPE_INFO[type].label, type, enabled: true, keep: 7, path: type === 'ordner' ? '/mnt/sicherung' : '', host: '', share: '', user: '', domain: '', port: 22, url: '', password: '' }
}

function add(type: TargetType) {
  editing.value = blank(type)
  editIndex.value = -1
}
function edit(i: number) {
  editing.value = { ...blank(targets.value[i].type), ...targets.value[i], password: '' }
  editIndex.value = i
}

async function save(list: Target[]) {
  if (!client.value) return false
  saving.value = true
  error.value = ''
  try {
    const r = await client.value.json<{ targets: Target[] }>('/api/admin/sicherung', 'PUT', { targets: list })
    targets.value = r.targets
    return true
  } catch (e) {
    error.value = (e as Error).message
    return false
  } finally {
    saving.value = false
  }
}

async function saveEdit() {
  if (!editing.value) return
  const list = [...targets.value]
  if (editIndex.value >= 0) list[editIndex.value] = editing.value
  else list.push(editing.value)
  if (await save(list)) {
    info.value = t('„{name}“ gespeichert. Tipp: gleich „Testen“.', { name: editing.value.name })
    editing.value = null
  }
}

async function remove(i: number) {
  if (!confirm(t('Ziel „{x}“ entfernen? Bereits gesicherte Dateien dort bleiben erhalten.', { x: targets.value[i].name }))) return
  await save(targets.value.filter((_, j) => j !== i))
}

async function toggle(i: number) {
  await save(targets.value.map((t, j) => (j === i ? { ...t, enabled: !t.enabled } : t)))
}

function where(t: Target): string {
  if (t.type === 'ordner') return t.path ?? ''
  if (t.type === 'smb') return `//${t.host}/${t.share}${t.path ? `/${t.path}` : ''}`
  if (t.type === 'ssh') return `${t.user}@${t.host}:${t.path}${t.port && t.port !== 22 ? ` (Port ${t.port})` : ''}`
  return t.url ?? ''
}

const needsKey = computed(() => editing.value?.type === 'ssh' || targets.value.some((t) => t.type === 'ssh'))
async function copyKey() {
  try {
    await navigator.clipboard.writeText(sshKey.value)
    info.value = t('Schlüssel kopiert.')
  } catch {
    /* Feld ist markierbar */
  }
}

const running = computed(() => pending.value || !!status.value?.running)
const passwordLabel = computed(() => (editing.value?.hasPassword ? t('Passwort (leer lassen = unverändert)') : t('Passwort')))
const form = reactive({ showPw: false })
</script>

<template>
  <div class="mb-3">
    <RouterLink to="/abgleich" class="small text-decoration-none"><i class="bi bi-chevron-left" aria-hidden="true"></i> {{ t('Geräte-Abgleich') }}</RouterLink>
    <h1 class="h3 mb-0 mt-1">{{ t('Server-Sicherung') }}</h1>
    <p class="text-body-secondary small mb-0">{{ t('Wohin der Server jede Nacht deine Reisen, Fotos und Einstellungen sichert.') }}</p>
  </div>

  <div v-if="error" class="alert alert-danger">{{ error }}</div>
  <div v-if="info" class="alert alert-info small py-2" role="status">{{ info }}</div>
  <div v-if="!installed && !loading" class="alert alert-warning small">
    {{ t('Auf dem Server ist die Sicherung noch nicht vollständig eingerichtet. Im Container einmal') }}
    <code>/opt/koffer-fertig-raus/server/proxmox/update.sh</code> {{ t('ausführen.') }}
  </div>

  <!-- Sicherung im Container -->
  <div class="card mb-3">
    <div class="card-body d-flex flex-wrap align-items-center gap-3">
      <i class="bi bi-archive fs-2 text-primary" aria-hidden="true"></i>
      <div class="flex-grow-1">
        <div class="fw-semibold">{{ t('Tägliche Sicherung im Container') }}</div>
        <div class="small text-body-secondary">
          <template v-if="status?.local">{{ t('Zuletzt {ago} · {size}', { ago: ago(status.local.at), size: status.local.size }) }}</template>
          <template v-else>{{ t('Noch keine Sicherung gemeldet') }}</template>
          {{ t('· danach an alle eingeschalteten Ziele unten') }}
        </div>
      </div>
      <button type="button" class="btn btn-primary" :disabled="running || loading" @click="start(null, false)">
        <span v-if="running" class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>
        <i v-else class="bi bi-play-fill me-1" aria-hidden="true"></i>{{ running ? t('Läuft …') : t('Jetzt sichern') }}
      </button>
    </div>
  </div>

  <!-- Ziele -->
  <h2 class="h6 text-body-secondary">{{ t('Weitere Ziele ({n})', { n: targets.length }) }}</h2>
  <div v-if="loading" class="small text-body-secondary mb-3"><span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>{{ t('Lade …') }}</div>
  <div v-for="(target, i) in targets" :key="target.id" class="card mb-2" :class="{ 'opacity-75': !target.enabled }">
    <div class="card-body">
      <div class="d-flex align-items-start gap-2">
        <i :class="`bi bi-${TYPE_INFO[target.type].icon} fs-4`" aria-hidden="true"></i>
        <div class="flex-grow-1 min-w-0">
          <div class="fw-semibold">{{ target.name }} <span class="badge text-bg-light border ms-1">{{ TYPE_INFO[target.type].label }}</span></div>
          <div class="small text-body-secondary text-truncate font-monospace">{{ where(target) }}</div>
          <div class="small text-body-secondary">{{ t('behält {keep} Stände', { keep: target.keep }) }}</div>
          <div v-if="target.id && status?.targets[target.id]?.at" class="small mt-1" :class="status.targets[target.id].ok ? 'text-success' : 'text-danger'">
            <i class="bi" :class="status.targets[target.id].ok ? 'bi-check-circle' : 'bi-x-circle'" aria-hidden="true"></i>
            {{ t('Sicherung {ago}: {x}', { ago: ago(status.targets[target.id].at), x: status.targets[target.id].message }) }}
          </div>
          <div v-if="target.id && status?.targets[target.id]?.lastTest" class="small" :class="status.targets[target.id].lastTest!.ok ? 'text-success' : 'text-danger'">
            <i class="bi" :class="status.targets[target.id].lastTest!.ok ? 'bi-plug' : 'bi-exclamation-triangle'" aria-hidden="true"></i>
            {{ t('Test {ago}: {x}', { ago: ago(status.targets[target.id].lastTest!.at), x: status.targets[target.id].lastTest!.message }) }}
          </div>
        </div>
        <div class="form-check form-switch flex-none">
          <input :id="`en-${target.id}`" class="form-check-input" type="checkbox" role="switch" :checked="target.enabled" :disabled="saving" @change="toggle(i)" />
          <label class="visually-hidden" :for="`en-${target.id}`">{{ t('Eingeschaltet') }}</label>
        </div>
      </div>
      <div class="d-flex flex-wrap gap-2 mt-2">
        <button type="button" class="btn btn-sm btn-outline-primary" :disabled="running" @click="start(target, true)"><i class="bi bi-plug me-1" aria-hidden="true"></i>{{ t('Testen') }}</button>
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="edit(i)">{{ t('Bearbeiten') }}</button>
        <button type="button" class="btn btn-sm btn-outline-danger ms-auto" @click="remove(i)"><i class="bi bi-trash" aria-hidden="true"></i><span class="visually-hidden">{{ t('Entfernen') }}</span></button>
      </div>
    </div>
  </div>

  <!-- Bearbeiten -->
  <div v-if="editing" class="card border-primary mb-3">
    <div class="card-body">
      <h2 class="h6"><i :class="`bi bi-${TYPE_INFO[editing.type].icon} me-1`" aria-hidden="true"></i>{{ editIndex >= 0 ? t('Ziel bearbeiten') : t('Neues Ziel: {x}', { x: TYPE_INFO[editing.type].label }) }}</h2>
      <p class="small text-body-secondary">{{ TYPE_INFO[editing.type].hint }}</p>
      <form class="row g-2" @submit.prevent="saveEdit">
        <div class="col-12 col-sm-8">
          <label class="form-label small mb-1" for="t-name">{{ t('Name') }}</label>
          <input id="t-name" v-model="editing.name" class="form-control form-control-sm" maxlength="60" required />
        </div>
        <div class="col-12 col-sm-4">
          <label class="form-label small mb-1" for="t-keep">{{ t('Stände behalten') }}</label>
          <input id="t-keep" v-model.number="editing.keep" type="number" min="1" max="60" class="form-control form-control-sm" />
        </div>

        <template v-if="editing.type === 'ordner'">
          <div class="col-12">
            <label class="form-label small mb-1" for="t-path">{{ t('Ordner im Container') }}</label>
            <input id="t-path" v-model="editing.path" class="form-control form-control-sm font-monospace" :placeholder="t('/mnt/sicherung')" required />
            <div class="form-text">
              {{ t('Für NFS oder eine SMB-Freigabe, die Proxmox einbindet: in Proxmox') }} <em>{{ t('Datacenter → Storage → Hinzufügen') }}</em>{{ t(', dann auf dem Host') }}
              <code>pct set &lt;CT-ID&gt; -mp0 /mnt/pve/&lt;name&gt;,mp=/mnt/sicherung</code> {{ t('– und hier') }} <code>/mnt/sicherung</code> {{ t('eintragen.') }}
            </div>
          </div>
        </template>

        <template v-if="editing.type === 'smb'">
          <div class="col-7">
            <label class="form-label small mb-1" for="t-host">{{ t('Server') }}</label>
            <input id="t-host" v-model="editing.host" class="form-control form-control-sm" :placeholder="t('192.168.5.10 oder nas')" required />
          </div>
          <div class="col-5">
            <label class="form-label small mb-1" for="t-share">{{ t('Freigabe') }}</label>
            <input id="t-share" v-model="editing.share" class="form-control form-control-sm" :placeholder="t('backup')" required />
          </div>
          <div class="col-12">
            <label class="form-label small mb-1" for="t-sub">{{ t('Unterordner (optional)') }}</label>
            <input id="t-sub" v-model="editing.path" class="form-control form-control-sm" :placeholder="t('Reise-App')" />
          </div>
          <div class="col-6">
            <label class="form-label small mb-1" for="t-user">{{ t('Benutzer') }}</label>
            <input id="t-user" v-model="editing.user" class="form-control form-control-sm" autocomplete="off" />
          </div>
          <div class="col-6">
            <label class="form-label small mb-1" for="t-dom">{{ t('Domäne (meist leer)') }}</label>
            <input id="t-dom" v-model="editing.domain" class="form-control form-control-sm" :placeholder="t('WORKGROUP')" />
          </div>
        </template>

        <template v-if="editing.type === 'ssh'">
          <div class="col-8">
            <label class="form-label small mb-1" for="t-host2">{{ t('Server') }}</label>
            <input id="t-host2" v-model="editing.host" class="form-control form-control-sm" placeholder="192.168.5.10" required />
          </div>
          <div class="col-4">
            <label class="form-label small mb-1" for="t-port">{{ t('Port') }}</label>
            <input id="t-port" v-model.number="editing.port" type="number" min="1" max="65535" class="form-control form-control-sm" />
          </div>
          <div class="col-6">
            <label class="form-label small mb-1" for="t-user2">{{ t('Benutzer') }}</label>
            <input id="t-user2" v-model="editing.user" class="form-control form-control-sm" required autocomplete="off" />
          </div>
          <div class="col-6">
            <label class="form-label small mb-1" for="t-path2">{{ t('Zielordner') }}</label>
            <input id="t-path2" v-model="editing.path" class="form-control form-control-sm font-monospace" :placeholder="t('/volume1/backup')" required />
          </div>
        </template>

        <template v-if="editing.type === 'webdav'">
          <div class="col-12">
            <label class="form-label small mb-1" for="t-url">{{ t('Adresse (Ordner)') }}</label>
            <input id="t-url" v-model="editing.url" class="form-control form-control-sm font-monospace" :placeholder="t('https://cloud.example.de/remote.php/dav/files/marco/Sicherung')" required />
          </div>
          <div class="col-12">
            <label class="form-label small mb-1" for="t-user3">{{ t('Benutzer') }}</label>
            <input id="t-user3" v-model="editing.user" class="form-control form-control-sm" autocomplete="off" />
          </div>
        </template>

        <div v-if="editing.type === 'smb' || editing.type === 'webdav'" class="col-12">
          <label class="form-label small mb-1" for="t-pw">{{ passwordLabel }}</label>
          <div class="input-group input-group-sm">
            <input id="t-pw" v-model="editing.password" :type="form.showPw ? 'text' : 'password'" class="form-control" autocomplete="new-password" />
            <button type="button" class="btn btn-outline-secondary" :aria-label="form.showPw ? t('Verbergen') : t('Anzeigen')" @click="form.showPw = !form.showPw">
              <i class="bi" :class="form.showPw ? 'bi-eye-slash' : 'bi-eye'" aria-hidden="true"></i>
            </button>
          </div>
          <div class="form-text">{{ t('Wird nur auf deinem Server gespeichert und nie wieder an die App geschickt. Tipp: eigenen Benutzer nur für Sicherungen anlegen.') }}</div>
        </div>

        <div class="col-12 d-flex gap-2 mt-2">
          <button type="submit" class="btn btn-primary btn-sm" :disabled="saving">{{ t('Speichern') }}</button>
          <button type="button" class="btn btn-outline-secondary btn-sm" @click="editing = null">{{ t('Abbrechen') }}</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Hinzufügen -->
  <div v-if="!editing" class="card mb-3">
    <div class="card-body">
      <h2 class="h6">{{ t('Ziel hinzufügen') }}</h2>
      <div class="row g-2">
        <div v-for="(ti, type) in TYPE_INFO" :key="type" class="col-12 col-sm-6">
          <button type="button" class="btn btn-outline-primary w-100 text-start h-100" :disabled="targets.length >= 8" @click="add(type)">
            <i :class="`bi bi-${ti.icon} me-2`" aria-hidden="true"></i><strong>{{ ti.label }}</strong>
            <span class="d-block small opacity-75">{{ ti.hint }}</span>
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- SSH-Schlüssel -->
  <div v-if="needsKey" class="card mb-3">
    <div class="card-body">
      <h2 class="h6"><i class="bi bi-key me-1" aria-hidden="true"></i>{{ t('Schlüssel für SSH-Ziele') }}</h2>
      <template v-if="sshKey">
        <p class="small">{{ t('Diesen öffentlichen Schlüssel beim Ziel für den Benutzer in') }} <code>~/.ssh/authorized_keys</code> {{ t('eintragen (Synology: Benutzer-Home aktivieren, SSH einschalten):') }}</p>
        <textarea class="form-control form-control-sm font-monospace mb-2" rows="3" readonly :value="sshKey" @focus="($event.target as HTMLTextAreaElement).select()"></textarea>
        <button type="button" class="btn btn-sm btn-outline-secondary" @click="copyKey"><i class="bi bi-clipboard me-1" aria-hidden="true"></i>{{ t('Kopieren') }}</button>
      </template>
      <p v-else class="small mb-0">{{ t('Noch kein Schlüssel – im Container einmal') }} <code>/opt/koffer-fertig-raus/server/proxmox/update.sh</code> {{ t('ausführen.') }}</p>
    </div>
  </div>

  <details class="small mb-3">
    <summary>{{ t('Wie wird gesichert – und wie hole ich es zurück?') }}</summary>
    <ul class="mt-2">
      <li>{{ t('Jede Nacht entsteht im Container eine Sicherung (Datenbank, Fotos, Einstellungen mit Schlüsseln). Danach wird sie an alle eingeschalteten Ziele übertragen.') }}</li>
      <li><strong>{{ t('Ordner, SSH:') }}</strong> {{ t('je Stand ein Ordner') }} <code>koffer-fertig-raus/&lt;datum_uhrzeit&gt;</code>{{ t('; Fotos liegen trotzdem nur einmal da.') }}</li>
      <li><strong>{{ t('SMB, WebDAV:') }}</strong> {{ t('je Stand Datenbank und Einstellungen in') }} <code>koffer-fertig-raus/&lt;datum_uhrzeit&gt;</code>{{ t(', alle Fotos gemeinsam in') }} <code>nix-wie-weg/fotos</code> {{ t('(nur neue werden hochgeladen).') }}</li>
      <li>{{ t('Zurückholen: Stand in den Container nach') }} <code>/var/backups/koffer-fertig-raus/&lt;datum_uhrzeit&gt;</code> {{ t('kopieren (bei SMB/WebDAV den Ordner') }} <code>fotos</code> {{ t('als') }} <code>blobs</code> {{ t('dazu), dann') }} <code>restore.sh &lt;datum_uhrzeit&gt;</code>.</li>
      <li>{{ t('Die Sicherung enthält deine Schlüssel – Ziel nur dort, wo niemand Fremdes Zugriff hat.') }}</li>
    </ul>
  </details>
</template>

<style scoped>
.min-w-0 {
  min-width: 0;
}
.flex-none {
  flex: none;
}
</style>
