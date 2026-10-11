import { reactive } from 'vue'
import { db, onLocalChange, type OutboxEntry } from '../db'
import { DATA_TABLES } from '../tables'
import { SyncApi, hashBlob } from './api'
import { asRemote, markRemote } from './tracking'
import { applyAction, isBlobRef, uploadStamp, type RemoteChange } from './logic'
import Dexie from 'dexie'

/** Sichtbarer Zustand des Abgleichs (für Anzeige in der App). */
export const syncState = reactive({
  configured: false,
  server: '',
  running: false,
  lastSync: null as string | null,
  lastError: '',
  pending: 0,
  progress: ''
})

const META = {
  server: 'sync.server',
  key: 'sync.key',
  lastSeq: 'sync.lastSeq',
  lastSync: 'sync.lastSync',
  initialized: 'sync.initialized'
} as const

const syncTables = new Set<string>(DATA_TABLES)

async function getMeta<T>(key: string, fallback: T): Promise<T> {
  return ((await db.meta.get(key))?.value as T) ?? fallback
}
async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}

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

/** Server einrichten. Danach werden alle vorhandenen Daten einmal hochgeladen und alles vom Server geholt. */
export async function configureSync(server: string, key: string): Promise<void> {
  await setMeta(META.server, server)
  await setMeta(META.key, key)
  await setMeta(META.lastSeq, 0)
  await setMeta(META.initialized, false)
  await loadSyncConfig()
  await syncNow()
}

/** Abgleich beenden – lokale Daten bleiben erhalten. */
export async function disconnectSync(): Promise<void> {
  await db.meta.bulkDelete(Object.values(META))
  await db.outbox.clear()
  await loadSyncConfig()
  syncState.lastError = ''
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
async function encodeForUpload(api: SyncApi, row: Record<string, unknown>, uploaded: Set<string>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { ...row }
  for (const [k, v] of Object.entries(row)) {
    if (!(v instanceof Blob)) continue
    const hash = await hashBlob(v)
    if (!uploaded.has(hash)) {
      if (!(await api.hasBlob(hash))) await api.putBlob(hash, v)
      uploaded.add(hash)
    }
    out[k] = { __blobRef: hash, type: v.type }
  }
  return out
}

async function decodeFromServer(api: SyncApi, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { ...data }
  for (const [k, v] of Object.entries(data)) {
    if (!isBlobRef(v)) continue
    const blob = await api.getBlob(v.__blobRef)
    out[k] = blob.type === v.type ? blob : new Blob([blob], { type: v.type })
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
        changes.push({ tbl: e.tbl, id: e.id, stamp: uploadStamp(row, e.at), deleted: false, data: await encodeForUpload(api, row, uploaded) })
      } else {
        changes.push({ tbl: e.tbl, id: e.id, stamp: e.at, deleted: true, data: null })
      }
    }
    if (changes.length) await api.push(changes)
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
        plan.push({ change: c, action, data: await decodeFromServer(api, c.data ?? {}) })
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
            if (p.action === 'delete') await t.delete(p.change.id)
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

let running: Promise<void> | null = null

/** Jetzt abgleichen: erst eigene Änderungen hochladen, dann die der anderen holen. */
export function syncNow(): Promise<void> {
  if (running) return running
  running = (async () => {
    const c = await credentials()
    if (!c) return
    if (!navigator.onLine) {
      syncState.lastError = 'Offline – wird nachgeholt, sobald Internet da ist.'
      return
    }
    syncState.running = true
    syncState.lastError = ''
    try {
      const api = new SyncApi(c.server, c.key)
      if (!(await getMeta(META.initialized, false))) {
        syncState.progress = 'Bereite ersten Abgleich vor …'
        await enqueueAll()
        await setMeta(META.initialized, true)
      }
      syncState.progress = 'Lade Änderungen hoch …'
      await pushOutbox(api)
      syncState.progress = 'Hole Änderungen …'
      await pullChanges(api)
      const now = new Date().toISOString()
      await setMeta(META.lastSync, now)
      syncState.lastSync = now
    } catch (e) {
      syncState.lastError = (e as Error).message
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
