<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue'
import qrcode from 'qrcode-generator'
import { ServerClient } from '../sync/client'
import { logoutThisDevice, syncState } from '../sync/engine'
import { ago, inviteLink } from '../sync/logic'
import { t, tn, intlLocale } from '@/i18n'

interface Device {
  id: string
  name: string
  created: string
  lastSeen: string | null
  agent: string
  current: boolean
  /** Zuletzt abgeglichen */
  synced: string | null
  /** So viele Änderungen fehlen dem Gerät noch (null = unbekannt, ältere App-Version) */
  behind: number | null
  /** So viele Änderungen hat das Gerät noch nicht hochgeladen */
  pending: number | null
}

const emit = defineEmits<{ loggedOut: [] }>()

const client = shallowRef<ServerClient | null>(null)
const devices = ref<Device[]>([])
const keyLastSeen = ref<string | null>(null)
const idleDays = ref(180)
const loading = ref(true)
const error = ref('')
const info = ref('')
const invite = ref<{ code: string; expires: string; link: string; svg: string } | null>(null)

async function load() {
  error.value = ''
  client.value = await ServerClient.fromSync()
  if (!client.value) return
  try {
    const r = await client.value.json<{ devices: Device[]; keyLastSeen: string | null; idleDays: number }>('/api/geraete')
    devices.value = r.devices
    keyLastSeen.value = r.keyLastSeen
    idleDays.value = r.idleDays
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
onMounted(load)
// Liste aktuell halten: nach jedem eigenen Abgleich und alle 30 s, solange die Seite offen ist
watch(() => syncState.lastSync, () => void load())
const timer = setInterval(() => document.visibilityState === 'visible' && void load(), 30_000)
onUnmounted(() => clearInterval(timer))

type SyncInfo = { level: 'ok' | 'warn' | 'unknown'; text: string }
/** Abgleich-Stand eines Geräts in Worten */
function syncInfo(d: Device): SyncInfo {
  if (d.behind === null && d.pending === null) return { level: 'unknown', text: t('Stand unbekannt – gleicht beim nächsten Öffnen ab') }
  const parts: string[] = []
  if (d.behind) parts.push(tn(d.behind, '1 Änderung fehlt noch', '{n} Änderungen fehlen noch'))
  if (d.pending) parts.push(t('{pending} noch nicht hochgeladen', { pending: d.pending }))
  if (d.behind === null) parts.unshift(t('noch nie vollständig abgeglichen'))
  return parts.length ? { level: 'warn', text: parts.join(' · ') } : { level: 'ok', text: t('auf dem neuesten Stand') }
}
const notReady = computed(() => devices.value.filter((d) => syncInfo(d).level === 'warn'))

const others = computed(() => devices.value.filter((d) => !d.current))
/** Melden sich noch Geräte direkt mit dem Gruppenschlüssel an (ältere App-Version)? */
const legacyActive = computed(() => !!keyLastSeen.value && Date.now() - new Date(keyLastSeen.value).getTime() < 14 * 86400_000)

async function rename(d: Device) {
  const name = prompt(t('Name des Geräts'), d.name)?.trim()
  if (!name || name === d.name || !client.value) return
  try {
    await client.value.json(`/api/geraete/${d.id}`, 'PATCH', { name })
    if (d.current) syncState.device = { id: d.id, name }
    await load()
  } catch (e) {
    error.value = (e as Error).message
  }
}

async function revoke(d: Device) {
  if (!client.value || !confirm(t('„{name}“ abmelden? Das Gerät gleicht danach nicht mehr ab – seine Daten bleiben dort erhalten.', { name: d.name }))) return
  try {
    await client.value.json(`/api/geraete/${d.id}`, 'DELETE')
    info.value = t('„{name}“ ist abgemeldet.', { name: d.name })
    await load()
  } catch (e) {
    error.value = (e as Error).message
  }
}

async function revokeOthers() {
  if (!client.value || !confirm(t('Alle {n} anderen Geräte abmelden? Nur dieses Gerät bleibt angemeldet.', { n: others.value.length }))) return
  try {
    const r = await client.value.json<{ revoked: number }>('/api/geraete/andere-abmelden', 'POST')
    info.value = t('{revoked} Geräte abgemeldet.', { revoked: r.revoked })
    await load()
  } catch (e) {
    error.value = (e as Error).message
  }
}

async function logoutHere() {
  if (!confirm(t('Dieses Gerät abmelden und den Abgleich beenden? Die Daten auf diesem Gerät bleiben erhalten.'))) return
  await logoutThisDevice()
  emit('loggedOut')
}

/** Adresse, unter der das neue Gerät die App öffnet: der eigene Server, wenn er die App ausliefert. */
async function appBase(): Promise<string> {
  const server = client.value!.server
  if (location.origin === new URL(server).origin) return location.href
  try {
    const r = await fetch(`${server}/api/health`, { cache: 'no-store' })
    if ((await r.json()).appHosted) return `${server}/`
  } catch {
    /* dann die aktuelle Adresse */
  }
  return location.href
}

async function newInvite() {
  if (!client.value) return
  error.value = ''
  try {
    const r = await client.value.json<{ code: string; expires: string }>('/api/einladungen', 'POST')
    const link = inviteLink(await appBase(), client.value.server, r.code)
    const qr = qrcode(0, 'M')
    qr.addData(link)
    qr.make()
    invite.value = { ...r, link, svg: qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true }) }
  } catch (e) {
    error.value = (e as Error).message
  }
}

async function shareInvite() {
  if (!invite.value) return
  const text = t('Einladung zu „KofferFertigRaus“ (gilt einmal, 24 Stunden):\n{link}\nOder in der App eingeben: {code}', { link: invite.value.link, code: invite.value.code })
  try {
    if (navigator.share) await navigator.share({ title: t('KofferFertigRaus – Einladung'), text })
    else {
      await navigator.clipboard.writeText(text)
      info.value = t('Einladung kopiert.')
    }
  } catch {
    /* abgebrochen */
  }
}

const until = (iso: string) =>
  new Intl.DateTimeFormat(intlLocale(), { weekday: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
</script>

<template>
  <div class="card mb-3">
    <div class="card-body">
      <h2 class="h6 d-flex align-items-center gap-2">
        <i class="bi bi-phone" aria-hidden="true"></i>{{ t('Angemeldete Geräte') }}
        <span v-if="syncState.device" class="small text-body-secondary fw-normal ms-auto">{{ t('Dieses Gerät: {name}', { name: syncState.device.name }) }}</span>
      </h2>

      <div v-if="!loading && devices.length > 1" class="small mb-2" :class="notReady.length ? 'text-warning-emphasis' : 'text-success'">
        <i class="bi" :class="notReady.length ? 'bi-exclamation-triangle' : 'bi-check2-all'" aria-hidden="true"></i>
        <template v-if="notReady.length">{{ t('{map} {x} noch nicht auf dem neuesten Stand.', { map: notReady.map((d) => d.name).join(', '), x: notReady.length === 1 ? 'ist' : 'sind' }) }}</template>
        <template v-else>{{ t('Alle Geräte sind auf dem neuesten Stand.') }}</template>
      </div>
      <div v-if="error" class="alert alert-danger small py-2">{{ error }}</div>
      <div v-if="info" class="alert alert-success small py-2" role="status">{{ info }}</div>
      <div v-if="loading" class="small text-body-secondary"><span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>{{ t('Lade …') }}</div>

      <div v-else class="list-group mb-2">
        <div v-for="d in devices" :key="d.id" class="list-group-item d-flex align-items-center gap-2">
          <i class="bi" :class="/iPad|iPhone|Android/.test(d.agent + d.name) ? 'bi-tablet' : 'bi-laptop'" aria-hidden="true"></i>
          <div class="flex-grow-1 min-w-0">
            <div class="text-truncate">
              {{ d.name }} <span v-if="d.current" class="badge text-bg-primary ms-1">{{ t('dieses Gerät') }}</span>
            </div>
            <div class="small text-body-secondary text-truncate">
              {{ t('{x} · zuletzt {ago}', { x: d.agent || 'unbekannt', ago: ago(d.synced ?? d.lastSeen ?? d.created) }) }}
            </div>
            <div class="small" :class="{ 'text-success': syncInfo(d).level === 'ok', 'text-warning-emphasis': syncInfo(d).level === 'warn', 'text-body-secondary': syncInfo(d).level === 'unknown' }">
              <i class="bi" :class="syncInfo(d).level === 'ok' ? 'bi-check2' : syncInfo(d).level === 'warn' ? 'bi-hourglass-split' : 'bi-question-circle'" aria-hidden="true"></i>
              {{ syncInfo(d).text }}
            </div>
          </div>
          <div class="dropdown flex-none">
            <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="dropdown" :aria-label="t('Aktionen für {name}', { name: d.name })"><i class="bi bi-three-dots" aria-hidden="true"></i></button>
            <ul class="dropdown-menu dropdown-menu-end">
              <li><button class="dropdown-item" @click="rename(d)">{{ t('Umbenennen') }}</button></li>
              <li v-if="d.current"><button class="dropdown-item text-danger" @click="logoutHere">{{ t('Dieses Gerät abmelden') }}</button></li>
              <li v-else><button class="dropdown-item text-danger" @click="revoke(d)">{{ t('Abmelden') }}</button></li>
            </ul>
          </div>
        </div>
        <div v-if="!devices.length" class="list-group-item small text-body-secondary">{{ t('Noch keine Geräte mit eigenem Zugang.') }}</div>
      </div>

      <p v-if="legacyActive" class="small text-body-secondary">
        <i class="bi bi-info-circle me-1" aria-hidden="true"></i>{{ t('Mindestens ein Gerät meldet sich noch direkt mit dem Gruppenschlüssel an (zuletzt {ago}). Es stellt beim nächsten Abgleich mit der neuen App-Version von selbst um.', { ago: ago(keyLastSeen) }) }}
      </p>

      <div class="d-flex flex-wrap gap-2">
        <button type="button" class="btn btn-primary btn-sm" @click="newInvite"><i class="bi bi-qr-code me-1" aria-hidden="true"></i>{{ t('Gerät hinzufügen') }}</button>
        <button v-if="others.length && syncState.device" type="button" class="btn btn-outline-danger btn-sm" @click="revokeOthers">{{ t('Alle anderen abmelden') }}</button>
      </div>

      <!-- Einladung -->
      <div v-if="invite" class="border rounded p-3 mt-3 text-center">
        <div class="qr mx-auto mb-2" role="img" :aria-label="t('QR-Code der Einladung')" v-html="invite.svg"></div>
        <div class="small mb-1">{{ t('Mit der Kamera des neuen Geräts scannen – oder in der App unter „Geräte-Abgleich“ eingeben:') }}</div>
        <div class="fs-4 font-monospace fw-semibold mb-1 user-select-all">{{ invite.code }}</div>
        <div class="small text-body-secondary mb-2">{{ t('Gilt einmal, bis {until}.', { until: until(invite.expires) }) }}</div>
        <button type="button" class="btn btn-outline-primary btn-sm" @click="shareInvite"><i class="bi bi-share me-1" aria-hidden="true"></i>{{ t('Einladung teilen') }}</button>
        <p class="small text-body-secondary mt-2 mb-0 text-start">
          {{ t('Tipp fürs iPad/iPhone: Ist die App dort schon auf dem Home-Bildschirm, öffne sie und gib den Code ein – der Link öffnet sonst nur Safari.') }}
        </p>
      </div>

      <p class="small text-body-secondary mt-3 mb-0">
        {{ t('Jedes Gerät hat einen eigenen Zugang. Verlorenes Gerät? Hier abmelden – alle anderen laufen weiter. Geräte, die {idleDays} Tage nicht da waren, werden automatisch abgemeldet.', { idleDays }) }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.qr {
  width: 200px;
  max-width: 100%;
  background: #fff;
  padding: 4px;
  border-radius: 0.5rem;
}
.qr :deep(svg) {
  display: block;
  width: 100%;
  height: auto;
}
.min-w-0 {
  min-width: 0;
}
.flex-none {
  flex: none;
}
</style>
