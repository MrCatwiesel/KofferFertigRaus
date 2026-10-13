import { getMeta, setMeta } from './meta'
import { safeBlobType } from './blob-types'
import { db } from './db'
import { decide, emptyStats, type MergeStats } from './merge'
import { DATA_TABLES } from './tables'

/** Alle Tabellen, die ins Backup gehören – zentral in tables.ts gepflegt. */
export const BACKUP_TABLES = DATA_TABLES

/** Tabellen mit großen Binärdaten – im Backup optional. */
export const LARGE_TABLES: readonly string[] = ['photos', 'appearance']

export interface BackupFile {
  app: 'nix-wie-weg'
  format: 1
  exportedAt: string
  /** Gesetzt, wenn nur eine einzelne Reise geteilt wurde */
  scope?: { tripId: string; title: string }
  tables: Record<string, unknown[]>
}

/** Platzhalter für eine Binärdatei (Foto) im JSON. */
interface EncodedBlob {
  __blob: string
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

/** data:-URL → Blob, ohne Netzwerk (funktioniert offline). */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, data] = dataUrl.split(',', 2)
  const type = safeBlobType(head.match(/^data:([^;,]+)/)?.[1])
  if (head.includes(';base64')) {
    const bin = atob(data)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    return new Blob([bytes], { type })
  }
  return new Blob([decodeURIComponent(data)], { type })
}

/** Ersetzt Blob-Felder (oberste Ebene) durch eingebettete data:-URLs. */
async function encodeRow(row: Record<string, unknown>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { ...row }
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Blob) out[k] = { __blob: await blobToDataUrl(v) } satisfies EncodedBlob
  }
  return out
}

function decodeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row }
  for (const [k, v] of Object.entries(row)) {
    if (v && typeof v === 'object' && typeof (v as EncodedBlob).__blob === 'string') out[k] = dataUrlToBlob((v as EncodedBlob).__blob)
  }
  return out
}

/** Exportiert alle Daten als JSON-Objekt (Sicherung, Gerätewechsel). Fotos nur auf Wunsch. */
export async function exportBackup(options: { includeLarge?: boolean } = {}): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {}
  for (const name of BACKUP_TABLES) {
    if (!options.includeLarge && LARGE_TABLES.includes(name)) continue
    const rows = (await db.table(name).toArray()) as Record<string, unknown>[]
    tables[name] = await Promise.all(rows.map(encodeRow))
  }
  return { app: 'nix-wie-weg', format: 1, exportedAt: new Date().toISOString(), tables }
}

/**
 * Exportiert nur eine Reise mit allem, was dazugehört (alle Tabellen mit `tripId`),
 * z. B. um sie mit Mitreisenden abzugleichen.
 */
export async function exportTrip(tripId: string, options: { includeLarge?: boolean } = {}): Promise<BackupFile> {
  const trip = (await db.trips.get(tripId)) as unknown as Record<string, unknown> | undefined
  if (!trip) throw new Error('Reise nicht gefunden.')
  const tables: Record<string, unknown[]> = { trips: [await encodeRow(trip)] }
  for (const name of BACKUP_TABLES) {
    if (name === 'trips' || (!options.includeLarge && LARGE_TABLES.includes(name))) continue
    if (!db.table(name).schema.idxByName.tripId) continue // gehört zu keiner Reise (z. B. Aussehen)
    const rows = (await db.table(name).where('tripId').equals(tripId).toArray()) as Record<string, unknown>[]
    tables[name] = await Promise.all(rows.map(encodeRow))
  }
  return { app: 'nix-wie-weg', format: 1, exportedAt: new Date().toISOString(), scope: { tripId, title: String(trip.title ?? '') }, tables }
}

/**
 * Liest ein Backup oder eine geteilte Reise ein und führt sie mit den vorhandenen Daten zusammen:
 * Neues wird ergänzt, Vorhandenes nur ersetzt, wenn die eingelesene Fassung neuer ist.
 * Gelöschtes wird nicht übertragen (ein auf dem anderen Gerät gelöschter Eintrag bleibt hier erhalten).
 */
export async function importBackup(file: BackupFile): Promise<MergeStats> {
  if (file?.app !== 'nix-wie-weg' || file.format !== 1) {
    throw new Error('Das ist keine Datei von „Nix wie weg“.')
  }
  // Umwandeln vor der Transaktion (innerhalb dürfen nur Datenbank-Aufrufe warten)
  const decoded = new Map<string, Record<string, unknown>[]>()
  for (const name of BACKUP_TABLES) {
    const rows = (file.tables[name] ?? []) as Record<string, unknown>[]
    decoded.set(name, rows.map(decodeRow))
  }
  const stats = emptyStats()
  await db.transaction('rw', BACKUP_TABLES.map((t) => db.table(t)), async () => {
    for (const name of BACKUP_TABLES) {
      const rows = decoded.get(name) ?? []
      if (!rows.length) continue
      const table = db.table(name)
      const keyPath = table.schema.primKey.keyPath as string
      const existing = await table.bulkGet(rows.map((r) => r[keyPath] as string))
      const toPut: Record<string, unknown>[] = []
      rows.forEach((row, i) => {
        const d = decide(existing[i] as Record<string, unknown> | undefined, row)
        if (d === 'add') stats.added++
        else if (d === 'update') stats.updated++
        else stats.unchanged++
        if (d !== 'skip') toPut.push(row)
      })
      if (toPut.length) await table.bulkPut(toPut)
    }
  })
  // Beim nächsten Abgleich alles noch einmal vom Server holen: dort gelöschte Einträge, die mit der Sicherung
  // wieder hereingekommen sind, werden dann auch hier wieder entfernt (sonst lebten sie nur auf diesem Gerät weiter)
  if (await getMeta<number>('sync.lastSeq', 0)) await setMeta('sync.lastSeq', 0)
  return stats
}

/** Startet im Browser den Download einer JSON-Datei. */
export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
