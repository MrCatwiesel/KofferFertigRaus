import { reactive } from 'vue'
import { db, onLocalChange, type OutboxEntry } from '../db'
import { deleteMeta, getMeta, setMeta } from '../meta'
import { DATA_TABLES } from '../tables'
import { DeviceRevokedError, SyncApi, SyncHttpError, hashBlob, loginDevice } from './api'
import { safeBlobType } from '../blob-types'
import { asRemote, markRemote } from './tracking'
import { applyAction, defaultDeviceName, isBlobRef, isInviteCode, normalizeInviteCode, uploadStamp, type RemoteChange } from './logic'
import Dexie from 'dexie'

/** Sichtbarer Zustand des Abgleichs (für Anzeige in der App). */
export const syncState = reactive({
  configured: false,
  server: '',
  running: false,
  lastSync: null as string | null,
  lastError: '',
  pending: 0,
  progress: '',
  /** Name dieses Geräts beim Server (eigener Gerätezugang) – leer bei Anmeldung mit Gruppenschlüssel */
  device: null as { id: string; name: string } | null,
  /** Grund, falls dieses Gerät abgemeldet wurde – dann ruht der Abgleich */
  revoked: '',
  /** Einzelne Einträge, die nicht vollständig abgeglichen werden konnten (der Rest läuft weiter) */
  warnings: [] as string[]
})

/** Höchstgröße einer Datei für den Server (Standard des Servers: 30 MB) */
const MAX_BLOB_BYTES = 30 * 1024 * 1024

function warn(text: string) {
  if (!syncState.warnings.includes(text)) syncState.warnings = [...syncState.warnings, text].slice(-20)
}
const label = (tbl: string, row: Record<string, unknown> | undefined) => String(row?.name ?? row?.title ?? row?.filename ?? row?.caption ?? '') || tbl

const META = {
  server: 'sync.server',
  key: 'sync.key',
  lastSeq: 'sync.lastSeq',
  lastSync: 'sync.lastSync',
  initialized: 'sync.initialized',
  epoch: 'sync.epoch',
  device: 'sync.device',
  revoked: 'sync.revoked'
} as const

/** Vorschlag für den Namen dieses Geräts */
export const suggestedDeviceName = () => defaultDeviceName(navigator.userAgent, navigator.maxTouchPoints ?? 0)

const syncTables = new Set<string>(DATA_TABLES)


async function credentials(): Promise<{ server: string; key: string } | null> {
  const server = await getMeta(META.server, '')
  const key = await getMeta(META.key, '')
  return server && key ? { server, key } : null
}

async function refreshPending() {
  syncState.pending = await db.outbox.count()
}

/** Einstellungen laden (beim App-Start). */
export async function loadSyncConfig(): Promise<void> {
  const c = await credentials()
  syncState.configured = !!c
  syncState.server = c?.server ?? ''
  syncState.lastSync = await getMeta<string | null>(META.lastSync, null)
  syncState.device = await getMeta<{ id: string; name: string } | null>(META.device, null)
  syncState.revoked = await getMeta(META.revoked, '')
  if (syncState.revoked) syncState.lastError = syncState.revoked
  await refreshPending()
}

/** Server-Adresse und Schlüssel des Abgleichs (für Zusatzdienste des Servers wie Piwigo) – oder null. */
export function syncCredentials(): Promise<{ server: string; key: string } | null> {
  return credentials()
}

/** Gespeicherten Schlüssel holen (für den Kopplungs-Link). */
export async function currentKey(): Promise<string> {
  return getMeta(META.key, '')
}

/** Verbindung zu einem Server prüfen, ohne etwas zu speichern. */
export async function testConnection(server: string, key: string) {
  return new SyncApi(server, key).info()
}

/**
 * Server einrichten – mit Gruppenschlüssel oder Einladungscode. Unterstützt der Server Gerätezugänge,
 * bekommt dieses Gerät seinen eigenen (der Gruppenschlüssel wird dann nicht gespeichert).
 * Danach werden alle vorhandenen Daten einmal hochgeladen und alles vom Server geholt.
 */
export async function configureSync(server: string, secret: string, deviceName = suggestedDeviceName()): Promise<void> {
  let key = secret
  let device: { id: string; name: string } | null = null
  if (isInviteCode(secret)) {
    const r = await loginDevice(server, { invite: normalizeInviteCode(secret), name: deviceName })
    key = r.token
    device = { id: r.device.id, name: r.device.name }
  } else {
    const info = await testConnection(server, secret)
    if (info.devices) {
      const r = await loginDevice(server, { key: secret, name: deviceName })
      key = r.token
      device = { id: r.device.id, name: r.device.name }
    }
  }
  await setMeta(META.server, server)
  await setMeta(META.key, key)
  await setMeta(META.device, device)
  await setMeta(META.revoked, '')
  await setMeta(META.lastSeq, 0)
  await setMeta(META.initialized, false)
  syncState.lastError = ''
  await loadSyncConfig()
  await syncNow()
}

/** Dieses Gerät beim Server abmelden und den Abgleich beenden (Daten auf dem Gerät bleiben). */
export async function logoutThisDevice(): Promise<void> {
  const c = await credentials()
  if (c?.key.startsWith('nwd_')) {
    try {
      await fetch(`${c.server}/api/geraete/ich`, { method: 'DELETE', headers: { Authorization: `Bearer ${c.key}` } })
    } catch {
      /* offline – der Zugang läuft dann irgendwann von selbst ab */
    }
  }
  await disconnectSync()
}

/** Abgleich beenden – lokale Daten bleiben erhalten. */
export async function disconnectSync(): Promise<void> {
  await deleteMeta(...Object.values(META))
  await db.outbox.clear()
  await loadSyncConfig()
  syncState.lastError = ''
  syncState.revoked = ''
  syncState.device = null
}

/** Beim ersten Abgleich: alle vorhandenen Datensätze vormerken. */
async function enqueueAll(): Promise<void> {
  const at = new Date().toISOString()
  for (const name of DATA_TABLES) {
    const table = db.table(name)
    const keys = (await table.toCollection().primaryKeys()) as string[]
    await db.outbox.bulkPut(keys.map((id) => ({ key: `${name}\u0001${id}`, tbl: name, id: String(id), at })))
  }
}

/** Ersetzt Bilder durch Verweise und lädt sie hoch, falls der Server sie noch nicht hat. */
async function encodeForUpload(api: SyncApi, tbl: string, row: Record<string, unknown>, uploaded: Set<string>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { ...row }
  for (const [k, v] of Object.entries(row)) {
    if (!(v instanceof Blob)) continue
    // Zu große Datei: ohne sie abgleichen (bleibt auf diesem Gerät) – sonst stünde der ganze Abgleich still
    if (v.size > MAX_BLOB_BYTES) {
      out[k] = null
      warn(`„${label(tbl, row)}“: Datei zu groß (${Math.round(v.size / 1048576)} MB) – bleibt nur auf diesem Gerät.`)
      continue
    }
    const hash = await hashBlob(v)
    if (!uploaded.has(hash)) {
      try {
        if (!(await api.hasBlob(hash))) await api.putBlob(hash, v)
      } catch (e) {
        if (!(e instanceof SyncHttpError && e.permanent)) throw e
        out[k] = null
        warn(`„${label(tbl, row)}“: ${e.message} – bleibt nur auf diesem Gerät.`)
        continue
      }
      uploaded.add(hash)
    }
    out[k] = { __blobRef: hash, type: v.type }
  }
  return out
}

async function decodeFromServer(api: SyncApi, tbl: string, data: Record<string, unknown>, local?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { ...data }
  for (const [k, v] of Object.entries(data)) {
    if (!isBlobRef(v)) continue
    try {
      const blob = await api.getBlob(v.__blobRef)
      const type = safeBlobType(v.type)
      out[k] = blob.type === type ? blob : new Blob([blob], { type })
    } catch (e) {
      // Datei fehlt auf dem Server (z. B. nach dem Zurückspielen einer Sicherung ohne Fotos): weitermachen,
      // vorhandene Fassung hier behalten – sonst bliebe der Abgleich für alle Geräte an dieser Stelle hängen
      if (!(e instanceof SyncHttpError && e.permanent)) throw e
      out[k] = local?.[k] instanceof Blob ? local[k] : null
      warn(`„${label(tbl, data)}“: Datei fehlt auf dem Server.`)
    }
  }
  return out
}

async function pushOutbox(api: SyncApi): Promise<void> {
  const uploaded = new Set<string>()
  for (;;) {
    const batch: OutboxEntry[] = await db.outbox.orderBy('key').limit(50).toArray()
    if (!batch.length) return
    const changes: RemoteChange[] = []
    let photos = 0
    for (const e of batch) {
      if (!syncTables.has(e.tbl)) continue
      const row = (await db.table(e.tbl).get(e.id)) as Record<string, unknown> | undefined
      if (row) {
        if (Object.values(row).some((v) => v instanceof Blob)) syncState.progress = `Lade Fotos hoch (${++photos}) …`
        changes.push({ tbl: e.tbl, id: e.id, stamp: uploadStamp(row, e.at), deleted: false, data: await encodeForUpload(api, e.tbl, row, uploaded) })
      } else {
        changes.push({ tbl: e.tbl, id: e.id, stamp: e.at, deleted: true, data: null })
      }
    }
    if (changes.length) {
      try {
        await api.push(changes)
      } catch (err) {
        if (!(err instanceof SyncHttpError && err.permanent)) throw err
        // Ein ungültiger Eintrag darf nicht alle anderen aufhalten: einzeln senden, Abgelehnte auslassen
        for (const c of changes) {
          try {
            await api.push([c])
          } catch (e1) {
            if (!(e1 instanceof SyncHttpError && e1.permanent)) throw e1
            warn(`Eintrag in „${c.tbl}“ vom Server abgelehnt – bleibt nur auf diesem Gerät.`)
          }
        }
      }
    }
    // Nur entfernen, was inzwischen nicht erneut geändert wurde
    await db.transaction('rw', db.outbox, async () => {
      const current = await db.outbox.bulkGet(batch.map((e) => e.key))
      const done = batch.filter((e, i) => current[i]?.at === e.at).map((e) => e.key)
      await db.outbox.bulkDelete(done)
      // Sicherheitsnetz gegen Endlosschleife: wurde nichts erledigt, abbrechen
      if (!done.length) throw new Error('Änderungen während des Hochladens – wird beim nächsten Abgleich fortgesetzt.')
    })
    await refreshPending()
  }
}

async function pullChanges(api: SyncApi): Promise<number> {
  let since = await getMeta<number>(META.lastSeq, 0)
  let applied = 0
  for (;;) {
    const page = await api.pull(since)
    const relevant = page.changes.filter((c) => syncTables.has(c.tbl))
    // 1. Entscheiden und Fotos laden – außerhalb der Datenbank-Transaktion
    const plan: { change: RemoteChange; action: 'put' | 'delete'; data?: Record<string, unknown> }[] = []
    for (const c of relevant) {
      const local = (await db.table(c.tbl).get(c.id)) as Record<string, unknown> | undefined
      const action = applyAction(local, c)
      if (action === 'skip') continue
      if (action === 'put') {
        if (Object.values(c.data ?? {}).some(isBlobRef)) syncState.progress = 'Lade Fotos …'
        plan.push({ change: c, action, data: await decodeFromServer(api, c.tbl, c.data ?? {}, local) })
      } else plan.push({ change: c, action })
    }
    // 2. Anwenden – als Abgleich markiert, damit es nicht zurückgeschickt wird
    if (plan.length) {
      const tables = [...new Set(plan.map((p) => p.change.tbl))].map((t) => db.table(t))
      await asRemote(() =>
        db.transaction('rw', tables, async () => {
          markRemote(Dexie.currentTransaction?.idbtrans)
          for (const p of plan) {
            const t = db.table(p.change.tbl)
            // Neu prüfen: während Fotos geladen wurden, kann hier jemand den Eintrag geändert haben – dann gewinnt die neuere Fassung
            const now = (await t.get(p.change.id)) as Record<string, unknown> | undefined
            const action = applyAction(now, p.change)
            if (action === 'skip') continue
            if (action === 'delete') await t.delete(p.change.id)
            else await t.put(p.data)
          }
        })
      )
      applied += plan.length
    }
    since = page.seq
    await setMeta(META.lastSeq, since)
    if (!page.more) return applied
  }
}

/**
 * Wurde auf dem Server eine Sicherung zurückgespielt (neue Kennung oder Zähler kleiner als hier bekannt),
 * gleicht das Gerät einmal vollständig ab: alles hochladen (neuere Stände gewinnen), alles neu holen.
 */
async function checkServerReset(api: SyncApi): Promise<SyncApi> {
  const info = await api.info()
  // Älterer Zugang mit dem Gruppenschlüssel → einmalig auf einen eigenen Gerätezugang umstellen
  const c = await credentials()
  if (info.devices && c && !c.key.startsWith('nwd_')) {
    try {
      const r = await loginDevice(c.server, { key: c.key, name: suggestedDeviceName() })
      const device = { id: r.device.id, name: r.device.name }
      await setMeta(META.key, r.token)
      await setMeta(META.device, device)
      syncState.device = device
      api = new SyncApi(c.server, r.token)
    } catch {
      /* nächstes Mal wieder versuchen – der Gruppenschlüssel funktioniert weiter */
    }
  } else if (info.device) {
    syncState.device = info.device
    await setMeta(META.device, info.device)
  }
  const known = await getMeta(META.epoch, '')
  const lastSeq = await getMeta<number>(META.lastSeq, 0)
  const newEpoch = !!info.epoch && !!known && info.epoch !== known
  const behind = typeof info.seq === 'number' && info.seq < lastSeq
  if (newEpoch || behind) {
    await setMeta(META.lastSeq, 0)
    await setMeta(META.initialized, false)
  }
  if (info.epoch) await setMeta(META.epoch, info.epoch)
  return api
}

let running: Promise<void> | null = null

/** Jetzt abgleichen: erst eigene Änderungen hochladen, dann die der anderen holen. */
export function syncNow(): Promise<void> {
  if (running) return running
  running = (async () => {
    const c = await credentials()
    if (!c) return
    if (syncState.revoked) return
    if (!navigator.onLine) {
      syncState.lastError = 'Offline – wird nachgeholt, sobald Internet da ist.'
      return
    }
    syncState.running = true
    syncState.lastError = ''
    try {
      const api = await checkServerReset(new SyncApi(c.server, c.key))
      if (!(await getMeta(META.initialized, false))) {
        syncState.progress = 'Bereite ersten Abgleich vor …'
        await enqueueAll()
        await setMeta(META.initialized, true)
      }
      syncState.progress = 'Lade Änderungen hoch …'
      await refreshPending()
      api.pending = syncState.pending
      await pushOutbox(api)
      syncState.progress = 'Hole Änderungen …'
      await refreshPending()
      api.pending = syncState.pending
      await pullChanges(api)
      const now = new Date().toISOString()
      await setMeta(META.lastSync, now)
      syncState.lastSync = now
    } catch (e) {
      syncState.lastError = (e as Error).message
      if (e instanceof DeviceRevokedError) {
        // Abgemeldet: Abgleich ruht, bis neu verbunden wird (kein ständiges Anklopfen beim Server)
        const text = `${e.message}${e.reason ? ` (${e.reason})` : ''} Mit Einladungscode oder Schlüssel neu verbinden – die Daten auf diesem Gerät bleiben erhalten.`
        syncState.revoked = text
        syncState.lastError = text
        await setMeta(META.revoked, text)
      }
    } finally {
      syncState.running = false
      syncState.progress = ''
      await refreshPending()
    }
  })().finally(() => {
    running = null
  })
  return running
}

let started = false

/** Automatischer Abgleich: beim Start, wenn Internet zurückkommt, beim Zurückkehren in die App, nach Änderungen und alle 5 Minuten. */
export function startAutoSync(): void {
  if (started) return
  started = true
  let debounce: ReturnType<typeof setTimeout> | undefined
  const soon = (ms: number) => {
    clearTimeout(debounce)
    debounce = setTimeout(() => {
      if (syncState.configured) void syncNow()
    }, ms)
  }
  void loadSyncConfig().then(() => soon(500))
  onLocalChange(() => {
    void refreshPending()
    soon(4000)
  })
  window.addEventListener('online', () => soon(1000))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') soon(1000)
  })
  setInterval(() => {
    if (document.visibilityState === 'visible') soon(0)
  }, 5 * 60 * 1000)
}
