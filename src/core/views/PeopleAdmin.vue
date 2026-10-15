<script setup lang="ts">
import { computed, onMounted, ref, shallowRef } from 'vue'
import { db } from '../db'
import { useLiveQuery } from '../composables'
import { ServerClient } from '../sync/client'
import { syncNow, syncState } from '../sync/engine'
import { ROLE_LABEL, TRIP_ROLE_LABEL, people, type MemberRole, type TripRole } from '../people'
import InviteBox from './InviteBox.vue'
import { t } from '@/i18n'

interface Member {
  id: string
  name: string
  role: MemberRole
  disabled: boolean
  hasPassword: boolean
  created: string
}
interface Device {
  id: string
  name: string
  agent: string
  current: boolean
  member: string | null
}
interface Invite {
  code: string
  expires: string
  person: string
  reset: boolean
}

const client = shallowRef<ServerClient | null>(null)
const members = ref<Member[]>([])
const devices = ref<Device[]>([])
const loading = ref(true)
const error = ref('')
const info = ref('')
const invite = ref<Invite | null>(null)

const newName = ref('')
const newRole = ref<MemberRole>('mitglied')
const selfName = ref('')
const selfPw = ref('')
const selfPw2 = ref('')
const busy = ref(false)

/** Aufgeklappte Person: Rechte je Reise */
const openId = ref('')
const access = ref<Record<string, TripRole>>({})

const trips = useLiveQuery(() => db.trips.orderBy('startDate').reverse().toArray(), [])

const roles = Object.keys(ROLE_LABEL) as MemberRole[]
const tripRoles = Object.keys(TRIP_ROLE_LABEL) as TripRole[]
/** Gerät ohne Person (mit Gruppenschlüssel verbunden) – kann sich selbst als erste Person eintragen */
const noPersonYet = computed(() => !people.me && !!syncState.device && !members.value.some((m) => m.role === 'verwalter' && !m.disabled))
const unassigned = computed(() => devices.value.filter((d) => !d.member))
const active = computed(() => members.value.filter((m) => !m.disabled))

async function load() {
  error.value = ''
  client.value = await ServerClient.fromSync()
  if (!client.value) {
    loading.value = false
    return
  }
  try {
    members.value = (await client.value.json<{ members: Member[] }>('/api/personen')).members
    // Personenliste der App sofort aktualisieren (z. B. für „Mit Konto verknüpfen“) – nicht erst beim nächsten Abgleich
    people.members = members.value.filter((m) => !m.disabled).map((m) => ({ id: m.id, name: m.name, role: m.role }))
    devices.value = (await client.value.json<{ devices: Device[] }>('/api/geraete')).devices
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
onMounted(load)

async function run(fn: () => Promise<void>) {
  error.value = ''
  info.value = ''
  busy.value = true
  try {
    await fn()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

const selfOk = computed(() => selfName.value.trim() && selfPw.value.length >= 8 && selfPw.value === selfPw2.value)

function setupSelf() {
  return run(async () => {
    await client.value!.json('/api/personen', 'POST', { name: selfName.value.trim(), self: true, password: selfPw.value })
    selfPw.value = selfPw2.value = ''
    info.value = t('Willkommen, {trim}! Du bist Verwalter. Lade jetzt die anderen ein.', { trim: selfName.value.trim() })
    await syncNow()
    await load()
  })
}

function addPerson() {
  const name = newName.value.trim()
  if (!name) return
  return run(async () => {
    const r = await client.value!.json<{ member: Member; invite: { code: string; expires: string } }>('/api/personen', 'POST', { name, role: newRole.value })
    invite.value = { ...r.invite, person: r.member.name, reset: false }
    newName.value = ''
    await load()
    void syncNow()
  })
}

function newInvite(m: Member) {
  return run(async () => {
    const r = await client.value!.json<{ code: string; expires: string }>(`/api/personen/${m.id}/einladung`, 'POST')
    invite.value = { ...r, person: m.name, reset: m.hasPassword }
  })
}

function update(m: Member, patch: Partial<Pick<Member, 'role' | 'disabled' | 'name'>>) {
  return run(async () => {
    await client.value!.json(`/api/personen/${m.id}`, 'PATCH', patch)
    await load()
    void syncNow()
  })
}

function rename(m: Member) {
  const name = prompt(t('Name'), m.name)?.trim()
  if (name && name !== m.name) return update(m, { name })
}

function toggleDisabled(m: Member) {
  if (!m.disabled && !confirm(t('{name} sperren? Alle Geräte von {name} werden abgemeldet. Die Daten bleiben erhalten.', { name: m.name }))) return
  return update(m, { disabled: !m.disabled })
}

function remove(m: Member) {
  if (!confirm(t('{name} entfernen? Die Geräte werden abgemeldet. Private Einträge von {name} sind danach für alle sichtbar.', { name: m.name }))) return
  return run(async () => {
    await client.value!.json(`/api/personen/${m.id}`, 'DELETE')
    if (openId.value === m.id) openId.value = ''
    await load()
    void syncNow()
  })
}

function toggleTrips(m: Member) {
  if (openId.value === m.id) {
    openId.value = ''
    return
  }
  return run(async () => {
    access.value = (await client.value!.json<{ access: Record<string, TripRole> }>(`/api/personen/${m.id}/zugriff`)).access
    openId.value = m.id
  })
}

const defaultRole = (m: Member): TripRole => (m.role === 'leser' ? 'lesen' : 'bearbeiten')

function setTripRole(m: Member, tripId: string, value: string) {
  return run(async () => {
    const role = value === '' ? null : value
    await client.value!.json(`/api/zugriff/${encodeURIComponent(tripId)}`, 'PUT', { member: m.id, role })
    access.value = (await client.value!.json<{ access: Record<string, TripRole> }>(`/api/personen/${m.id}/zugriff`)).access
  })
}

function assignDevice(d: Device, memberId: string) {
  if (!memberId) return
  const m = members.value.find((x) => x.id === memberId)
  if (!confirm(t('„{name}“ gehört ab jetzt {name2}? Das Gerät gleicht danach einmal neu ab und sieht nur noch, was {name2} sehen darf.', { name: d.name, name2: m?.name }))) return
  return run(async () => {
    await client.value!.json(`/api/geraete/${d.id}`, 'PATCH', { member: memberId })
    info.value = t('„{name}“ gehört jetzt {name2}.', { name: d.name, name2: m?.name })
    await load()
    if (d.current) await syncNow()
  })
}
</script>

<template>
  <div class="mb-3">
    <RouterLink to="/abgleich" class="small text-decoration-none"><i class="bi bi-chevron-left" aria-hidden="true"></i> {{ t('Geräte-Abgleich') }}</RouterLink>
    <h1 class="h3 mb-0 mt-1">{{ t('Personen & Rechte') }}</h1>
    <p class="text-body-secondary small mb-0">{{ t('Wer ist in der Reisegruppe, wer darf was – und was bleibt privat.') }}</p>
  </div>

  <div v-if="error" class="alert alert-danger">{{ error }}</div>
  <div v-if="info" class="alert alert-success" role="status">{{ info }}</div>
  <div v-if="!syncState.configured" class="alert alert-info">{{ t('Erst den Geräte-Abgleich einrichten.') }}</div>
  <div v-else-if="loading" class="small text-body-secondary"><span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span>{{ t('Lade …') }}</div>

  <template v-else-if="client">
    <!-- Erste Person: ich -->
    <div v-if="noPersonYet" class="card mb-3 border-primary" data-self-setup>
      <div class="card-body">
        <h2 class="h6"><i class="bi bi-person-badge me-1" aria-hidden="true"></i>{{ t('Zuerst: Wer bist du?') }}</h2>
        <p class="small">
          {{ t('Dieses Gerät ist mit dem Schlüssel der Reisegruppe verbunden. Trag dich als erste Person ein – du wirst Verwalter und kannst danach die anderen einladen. Mit dem Passwort meldest du später weitere Geräte an.') }}
        </p>
        <div class="row g-2">
          <div class="col-12 col-md-4">
            <label for="self-name" class="form-label small">{{ t('Dein Name') }}</label>
            <input id="self-name" v-model="selfName" class="form-control" maxlength="60" :placeholder="t('z. B. Marco')" autocomplete="username" />
          </div>
          <div class="col-6 col-md-4">
            <label for="self-pw" class="form-label small">{{ t('Passwort') }}</label>
            <input id="self-pw" v-model="selfPw" type="password" class="form-control" autocomplete="new-password" />
          </div>
          <div class="col-6 col-md-4">
            <label for="self-pw2" class="form-label small">{{ t('Wiederholen') }}</label>
            <input id="self-pw2" v-model="selfPw2" type="password" class="form-control" autocomplete="new-password" />
          </div>
        </div>
        <div class="form-text">{{ t('Mindestens 8 Zeichen.') }}<span v-if="selfPw2 && selfPw !== selfPw2" class="text-danger"> {{ t('Die Passwörter stimmen nicht überein.') }}</span></div>
        <button type="button" class="btn btn-primary mt-2" :disabled="!selfOk || busy" @click="setupSelf">{{ t('Das bin ich') }}</button>
      </div>
    </div>

    <!-- Personen -->
    <div class="card mb-3">
      <div class="card-body">
        <h2 class="h6"><i class="bi bi-people me-1" aria-hidden="true"></i>{{ t('Personen') }}</h2>
        <div class="list-group mb-3" data-members>
          <div v-for="m in members" :key="m.id" class="list-group-item" :data-member="m.name">
            <div class="d-flex align-items-center gap-2 flex-wrap">
              <i class="bi" :class="m.disabled ? 'bi-person-slash text-body-secondary' : 'bi-person-circle'" aria-hidden="true"></i>
              <div class="flex-grow-1">
                <span class="fw-semibold">{{ m.name }}</span>
                <span v-if="m.id === people.me?.id" class="badge text-bg-primary ms-1">{{ t('ich') }}</span>
                <span v-if="m.disabled" class="badge text-bg-secondary ms-1">{{ t('gesperrt') }}</span>
                <span v-else-if="!m.hasPassword" class="badge text-bg-warning ms-1">{{ t('Einladung offen') }}</span>
              </div>
              <select class="form-select form-select-sm w-auto" :value="m.role" :aria-label="t('Rolle von {name}', { name: m.name })" :disabled="busy"
                      @change="update(m, { role: ($event.target as HTMLSelectElement).value as MemberRole })">
                <option v-for="r in roles" :key="r" :value="r">{{ ROLE_LABEL[r] }}</option>
              </select>
              <button type="button" class="btn btn-sm btn-outline-secondary" :aria-expanded="openId === m.id" @click="toggleTrips(m)">
                <i class="bi bi-suitcase2 me-1" aria-hidden="true"></i>{{ t('Reisen') }}
              </button>
              <div class="dropdown">
                <button class="btn btn-sm btn-outline-secondary" data-bs-toggle="dropdown" :aria-label="t('Aktionen für {name}', { name: m.name })"><i class="bi bi-three-dots" aria-hidden="true"></i></button>
                <ul class="dropdown-menu dropdown-menu-end">
                  <li><button class="dropdown-item" @click="newInvite(m)">{{ m.hasPassword ? t('Passwort zurücksetzen') : t('Neue Einladung') }}</button></li>
                  <li><button class="dropdown-item" @click="rename(m)">{{ t('Umbenennen') }}</button></li>
                  <li v-if="m.id !== people.me?.id"><button class="dropdown-item" @click="toggleDisabled(m)">{{ m.disabled ? t('Entsperren') : t('Sperren') }}</button></li>
                  <li v-if="m.id !== people.me?.id"><button class="dropdown-item text-danger" @click="remove(m)">{{ t('Entfernen') }}</button></li>
                </ul>
              </div>
            </div>
            <!-- Rechte je Reise -->
            <div v-if="openId === m.id" class="mt-2" data-trip-access>
              <div v-if="m.role === 'verwalter'" class="small text-body-secondary">{{ t('Verwalter sehen und bearbeiten alle Reisen (private Einträge anderer bleiben privat).') }}</div>
              <template v-else>
                <div class="small text-body-secondary mb-1">{{ t('Standard: {x} (aus der Rolle). Abweichend je Reise:', { x: TRIP_ROLE_LABEL[defaultRole(m)] }) }}</div>
                <div v-for="trip in trips" :key="trip.id" class="d-flex align-items-center gap-2 py-1 border-top">
                  <span class="flex-grow-1 small text-truncate">{{ trip.title }}</span>
                  <select class="form-select form-select-sm w-auto" :value="access[trip.id] ?? ''" :aria-label="`${m.name}: ${trip.title}`" :disabled="busy"
                          @change="setTripRole(m, trip.id, ($event.target as HTMLSelectElement).value)">
                    <option value="">{{ t('Standard ({x})', { x: TRIP_ROLE_LABEL[defaultRole(m)] }) }}</option>
                    <option v-for="r in tripRoles" :key="r" :value="r">{{ TRIP_ROLE_LABEL[r] }}</option>
                  </select>
                </div>
                <div v-if="!trips.length" class="small text-body-secondary">{{ t('Noch keine Reisen.') }}</div>
              </template>
            </div>
          </div>
          <div v-if="!members.length" class="list-group-item small text-body-secondary">{{ t('Noch keine Personen – alle Geräte haben vollen Zugriff.') }}</div>
        </div>

        <form v-if="!noPersonYet" class="row g-2 align-items-end" @submit.prevent="addPerson">
          <div class="col-12 col-md-5">
            <label for="new-name" class="form-label small">{{ t('Person einladen') }}</label>
            <input id="new-name" v-model="newName" class="form-control" maxlength="60" :placeholder="t('Name, z. B. Birgit')" />
          </div>
          <div class="col-7 col-md-4">
            <label for="new-role" class="form-label small">{{ t('Rolle') }}</label>
            <select id="new-role" v-model="newRole" class="form-select">
              <option v-for="r in roles" :key="r" :value="r">{{ ROLE_LABEL[r] }}</option>
            </select>
          </div>
          <div class="col-5 col-md-3">
            <button type="submit" class="btn btn-primary w-100" :disabled="!newName.trim() || busy"><i class="bi bi-person-plus me-1" aria-hidden="true"></i>{{ t('Einladen') }}</button>
          </div>
        </form>

        <InviteBox v-if="invite" :key="invite.code" class="mt-3" :server="client.server" :code="invite.code" :expires="invite.expires" :person="invite.person" :reset="invite.reset" />
      </div>
    </div>

    <!-- Geräte ohne Person -->
    <div v-if="unassigned.length && active.length" class="card mb-3">
      <div class="card-body">
        <h2 class="h6"><i class="bi bi-phone me-1" aria-hidden="true"></i>{{ t('Geräte ohne Person') }}</h2>
        <p class="small text-body-secondary">{{ t('Diese Geräte sind mit dem Gruppenschlüssel verbunden und sehen alles. Ordne sie einer Person zu, dann gelten deren Rechte.') }}</p>
        <div v-for="d in unassigned" :key="d.id" class="d-flex align-items-center gap-2 py-1 border-top" :data-device="d.name">
          <span class="flex-grow-1 small">{{ d.name }} <span v-if="d.current" class="badge text-bg-primary">{{ t('dieses Gerät') }}</span></span>
          <select class="form-select form-select-sm w-auto" value="" :aria-label="t('{name} zuordnen', { name: d.name })" :disabled="busy" @change="assignDevice(d, ($event.target as HTMLSelectElement).value)">
            <option value="">{{ t('Person wählen …') }}</option>
            <option v-for="m in active" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
      </div>
    </div>

    <details class="small mb-3">
      <summary>{{ t('So funktionieren die Rechte') }}</summary>
      <ul class="mt-2">
        <li><strong>{{ t('Verwalter') }}</strong> {{ t('laden ein, vergeben Rollen und Rechte je Reise.') }} <strong>{{ t('Mitglieder') }}</strong> {{ t('bearbeiten alle Reisen,') }} <strong>{{ t('Nur lesen') }}</strong> {{ t('sieht alles, ändert nichts.') }}</li>
        <li>{{ t('Je Reise lässt sich das abweichend einstellen – bis „Kein Zugriff“: Dann kommt die Reise gar nicht erst auf die Geräte der Person.') }}</li>
        <li><strong>{{ t('Privat:') }}</strong> {{ t('Packliste, Medikamente, Impfungen und Dokumente einer Person sieht nur sie selbst – sobald ihr Teilnehmer-Name an der Reise mit ihrem Konto verknüpft ist (Reise bearbeiten → „Wer reist mit?“). Auch Verwalter sehen sie nicht.') }}</li>
        <li>{{ t('Dokumente und Medikamente (z. B. Allergiepass, INR-Ausweis) kann die Person selbst freigeben – für alle oder ausgewählte Personen.') }}</li>
        <li>{{ t('Nicht verknüpfte Teilnehmer (z. B. Kinder) und Einträge „für alle“ sieht die ganze Gruppe.') }}</li>
        <li>{{ t('Der Server setzt die Rechte durch. Geräte ohne Person (Gruppenschlüssel) haben weiterhin vollen Zugriff – den Schlüssel also gut aufbewahren.') }}</li>
      </ul>
    </details>
  </template>
</template>
