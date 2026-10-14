<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { formatBytes } from '../storage'
import { ServerClient } from '../sync/client'
import { ago, pairingLink } from '../sync/logic'

/** Reisegruppen auf dem eigenen Server verwalten (nur für den Besitzer des Servers). */
interface Group {
  space: string
  name: string
  source: 'env' | 'app'
  owner: boolean
  piwigo: boolean
  disabled: boolean
  created: string
  lastSeen: string | null
  records: number
  bytes: number
}

type State = 'loading' | 'no-sync' | 'not-admin' | 'error' | 'ready'
const state = ref<State>('loading')
const message = ref('')
const groups = ref<Group[]>([])
const newName = ref('')
const newPiwigo = ref(false)
const busy = ref(false)
const invite = ref<{ name: string; key: string; link: string } | null>(null)
const copied = ref(false)
let client: ServerClient | null = null

onMounted(load)

async function load() {
  state.value = 'loading'
  client = await ServerClient.fromSync()
  if (!client) return (state.value = 'no-sync')
  const info = await client.info()
  if (!info) {
    state.value = 'error'
    message.value = 'Server nicht erreichbar.'
    return
  }
  if (!info.admin) return (state.value = 'not-admin')
  try {
    groups.value = (await client.json<{ groups: Group[] }>('/api/admin/groups')).groups
    state.value = 'ready'
  } catch (e) {
    state.value = 'error'
    message.value = (e as Error).message
  }
}

async function create() {
  if (!client || !newName.value.trim()) return
  busy.value = true
  message.value = ''
  try {
    const r = await client.json<{ key: string; group: Group }>('/api/admin/groups', 'POST', { name: newName.value.trim(), piwigo: newPiwigo.value })
    invite.value = { name: r.group.name, key: r.key, link: pairingLink(location.href, client.server, r.key) }
    newName.value = ''
    newPiwigo.value = false
    await load()
  } catch (e) {
    message.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

async function patch(g: Group, change: Partial<Pick<Group, 'piwigo' | 'disabled' | 'name'>>) {
  if (!client) return
  try {
    const fresh = await client.json<Group>(`/api/admin/groups/${g.space}`, 'PATCH', change)
    groups.value = groups.value.map((x) => (x.space === g.space ? { ...x, ...fresh } : x))
  } catch (e) {
    message.value = (e as Error).message
  }
}

async function rename(g: Group) {
  const name = prompt('Neuer Name der Reisegruppe:', g.name)
  if (name?.trim()) await patch(g, { name: name.trim() })
}

/** Neuer Schlüssel: der alte gilt sofort nicht mehr, angemeldete Geräte der Gruppe bleiben angemeldet. */
async function rotate(g: Group) {
  if (!client || !confirm(`Neuen Schlüssel für „${g.name}“ erzeugen? Der alte gilt dann nicht mehr. Geräte mit eigenem Zugang bleiben angemeldet.`)) return
  try {
    const r = await client.json<{ key: string; group: Group }>(`/api/admin/groups/${g.space}`, 'PATCH', { newKey: true })
    invite.value = { name: r.group.name, key: r.key, link: pairingLink(location.href, client.server, r.key) }
  } catch (e) {
    message.value = (e as Error).message
  }
}

async function remove(g: Group) {
  if (!client) return
  const really = prompt(`„${g.name}“ mit ALLEN Reisen und Fotos auf dem Server löschen? Zum Bestätigen den Namen eintippen:`)
  if (really?.trim() !== g.name) return
  try {
    await client.json(`/api/admin/groups/${g.space}`, 'DELETE')
    groups.value = groups.value.filter((x) => x.space !== g.space)
  } catch (e) {
    message.value = (e as Error).message
  }
}

async function copyInvite() {
  if (!invite.value) return
  try {
    await navigator.clipboard.writeText(invite.value.link)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    prompt('Einladungslink kopieren:', invite.value.link)
  }
}

async function shareInvite() {
  if (!invite.value) return
  try {
    await navigator.share({ title: `KofferFertigRaus – ${invite.value.name}`, text: 'Einladung zu deiner eigenen Reisegruppe:', url: invite.value.link })
  } catch {
    /* abgebrochen */
  }
}
const canShare = typeof navigator !== 'undefined' && !!navigator.share
</script>

<template>
  <div class="mb-3">
    <RouterLink to="/abgleich" class="small text-decoration-none"><i class="bi bi-chevron-left" aria-hidden="true"></i> Geräte-Abgleich</RouterLink>
    <h1 class="h3 mb-0 mt-1">Reisegruppen</h1>
  </div>
  <p class="text-body-secondary small">
    Jede Reisegruppe hat ihren eigenen Schlüssel und sieht nur ihre eigenen Reisen. Freunde, die die App selbst nutzen möchten,
    bekommen hier eine eigene Gruppe. Piwigo ist nur für Gruppen nutzbar, die du freigibst.
  </p>

  <div v-if="state === 'loading'" class="text-center my-5"><span class="spinner-border text-primary" aria-label="Lädt"></span></div>
  <div v-else-if="state === 'no-sync'" class="alert alert-info">Zuerst den <RouterLink to="/abgleich">Geräte-Abgleich</RouterLink> einrichten.</div>
  <div v-else-if="state === 'not-admin'" class="alert alert-info">Reisegruppen verwaltet nur der Besitzer des Servers.</div>
  <div v-else-if="state === 'error'" class="alert alert-warning d-flex gap-2">
    <span class="flex-grow-1">{{ message }}</span>
    <button type="button" class="btn btn-sm btn-outline-secondary" @click="load">Erneut</button>
  </div>

  <template v-else>
    <div v-if="message" class="alert alert-danger">{{ message }}</div>

    <div v-if="invite" class="alert alert-success">
      <div class="fw-semibold mb-1"><i class="bi bi-person-plus me-1" aria-hidden="true"></i>Gruppe „{{ invite.name }}“ angelegt</div>
      <p class="small mb-2">
        Schick den Einladungslink an deine Freunde. Sie öffnen ihn, installieren die App und tippen auf „Verbinden“.
        <strong>Der Schlüssel wird nur jetzt angezeigt.</strong>
      </p>
      <div class="small text-break mb-2">Schlüssel: <code>{{ invite.key }}</code></div>
      <div class="d-flex flex-wrap gap-2">
        <button v-if="canShare" type="button" class="btn btn-sm btn-success" @click="shareInvite"><i class="bi bi-box-arrow-up me-1" aria-hidden="true"></i>Einladung teilen</button>
        <button type="button" class="btn btn-sm btn-outline-success" @click="copyInvite"><i class="bi bi-clipboard me-1" aria-hidden="true"></i>{{ copied ? 'Kopiert' : 'Link kopieren' }}</button>
        <button type="button" class="btn btn-sm btn-link" @click="invite = null">Schließen</button>
      </div>
    </div>

    <section class="card mb-3">
      <div class="card-body">
        <h2 class="h6 card-title"><i class="bi bi-people me-1" aria-hidden="true"></i>Neue Reisegruppe</h2>
        <div class="input-group mb-2">
          <input v-model="newName" class="form-control" maxlength="80" placeholder="z. B. Familie Müller" aria-label="Name der Gruppe" @keyup.enter="create" />
          <button type="button" class="btn btn-primary" :disabled="busy || !newName.trim()" @click="create">Anlegen</button>
        </div>
        <div class="form-check form-switch">
          <input id="g-piwigo" v-model="newPiwigo" class="form-check-input" type="checkbox" role="switch" />
          <label class="form-check-label small" for="g-piwigo">Darf deine Piwigo-Galerie nutzen</label>
        </div>
      </div>
    </section>

    <div v-for="g in groups" :key="g.space" class="card mb-2" :class="{ 'opacity-75': g.disabled }">
      <div class="card-body py-2">
        <div class="d-flex align-items-start gap-2">
          <div class="flex-grow-1 min-w-0">
            <div class="fw-semibold">
              {{ g.name }}
              <span v-if="g.owner" class="badge text-bg-primary ms-1">Du</span>
              <span v-if="g.disabled" class="badge text-bg-secondary ms-1">gesperrt</span>
            </div>
            <div class="small text-body-secondary">
              {{ g.records }} Einträge · {{ formatBytes(g.bytes) }} Fotos · zuletzt aktiv {{ ago(g.lastSeen) }}
              <span v-if="g.source === 'env'"> · fest eingetragen</span>
            </div>
          </div>
          <button type="button" class="btn btn-sm btn-outline-secondary" aria-label="Umbenennen" @click="rename(g)"><i class="bi bi-pencil" aria-hidden="true"></i></button>
        </div>
        <div v-if="!g.owner" class="d-flex flex-wrap align-items-center gap-3 mt-2">
          <div class="form-check form-switch mb-0">
            <input :id="`p-${g.space}`" class="form-check-input" type="checkbox" role="switch" :checked="g.piwigo" @change="patch(g, { piwigo: !g.piwigo })" />
            <label class="form-check-label small" :for="`p-${g.space}`">Piwigo</label>
          </div>
          <div class="form-check form-switch mb-0">
            <input :id="`d-${g.space}`" class="form-check-input" type="checkbox" role="switch" :checked="!g.disabled" @change="patch(g, { disabled: !g.disabled })" />
            <label class="form-check-label small" :for="`d-${g.space}`">Zugang aktiv</label>
          </div>
          <button v-if="g.source === 'app'" type="button" class="btn btn-sm btn-outline-secondary ms-auto" @click="rotate(g)">
            <i class="bi bi-key me-1" aria-hidden="true"></i>Neuer Schlüssel
          </button>
          <button v-if="g.source === 'app'" type="button" class="btn btn-sm btn-outline-danger" @click="remove(g)">
            <i class="bi bi-trash me-1" aria-hidden="true"></i>Löschen
          </button>
        </div>
      </div>
    </div>

    <p class="small text-body-secondary mt-3">
      <i class="bi bi-info-circle me-1" aria-hidden="true"></i>
      Die Daten aller Gruppen liegen auf deinem Server. Technisch kannst du als Betreiber sie einsehen – sag das deinen Freunden ehrlich.
    </p>
  </template>
</template>
