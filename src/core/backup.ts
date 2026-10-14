import { getMeta, setMeta } from './meta'
import { db } from './db'
import { decide, emptyStats, type MergeStats } from './merge'
import { DATA_TABLES } from './tables'
import { readBackup, writeBackup, type BackupMeta, type BackupSource } from './backup-format'
import { t } from '@/core/i18n'

export { dataUrlToBlob, type BackupFile, type BackupMeta } from './backup-format'

/** Alle Tabellen, die ins Backup gehören – zentral in tables.ts gepflegt. */
export const BACKUP_TABLES = DATA_TABLES

/** Tabellen mit großen Binärdaten – im Backup optional. */
export const LARGE_TABLES: readonly string[] = ['photos', 'voiceNotes', 'appearance']

/** Datensätze stückweise lesen (erst nur die Schlüssel, dann je 50) – hält den Speicherbedarf klein */
async function* rowsOf(name: string, tripId?: string): AsyncIterable<Record<string, unknown>[]> {
  const table = db.table(name)
  const keys = await (tripId ? table.where('tripId').equals(tripId) : table.toCollection()).primaryKeys()
  for (let i = 0; i < keys.length; i += 50) {
    const rows = await table.bulkGet(keys.slice(i, i + 50))
    yield rows.filter((r): r is Record<string, unknown> => !!r)
  }
}

export interface BackupResult {
  blob: Blob
  exportedAt: string
}

export interface ExportOptions {
  /** Fotos und eigene Hintergrundbilder mitsichern */
  includeLarge?: boolean
  /** Fortschritt 0…1 (Anteil der geschriebenen Datensätze) */
  onProgress?: (fraction: number) => void
}

/** Zählt mit, wie viele Datensätze schon geschrieben sind */
async function progressCounter(tables: string[], onProgress?: (fraction: number) => void, tripId?: string) {
  if (!onProgress) return undefined
  const counts = await Promise.all(tables.map((n) => (tripId ? db.table(n).where('tripId').equals(tripId) : db.table(n).toCollection()).count()))
  const total = Math.max(1, counts.reduce((a, b) => a + b, 0))
  let done = 0
  let last = 0
  return () => {
    done++
    const f = done / total
    if (f - last >= 0.01 || done === total) onProgress((last = f))
  }
}

/** Sicherung aller Daten als Datei (Gerätewechsel, Ernstfall). Fotos nur auf Wunsch. */
export async function exportBackup(options: ExportOptions = {}): Promise<BackupResult> {
  const meta: BackupMeta = { app: 'nix-wie-weg', format: 1, exportedAt: new Date().toISOString() }
  const tables = BACKUP_TABLES.filter((n) => options.includeLarge || !LARGE_TABLES.includes(n))
  async function* source(): BackupSource {
    for (const name of tables) yield { table: name, rows: rowsOf(name) }
  }
  return { blob: await writeBackup(meta, source(), await progressCounter(tables, options.onProgress)), exportedAt: meta.exportedAt }
}

/**
 * Nur eine Reise mit allem, was dazugehört (alle Tabellen mit `tripId`),
 * z. B. um sie mit Mitreisenden abzugleichen.
 */
export async function exportTrip(tripId: string, options: ExportOptions = {}): Promise<BackupResult> {
  const trip = (await db.trips.get(tripId)) as unknown as Record<string, unknown> | undefined
  if (!trip) throw new Error(t('Reise nicht gefunden.'))
  const meta: BackupMeta = { app: 'nix-wie-weg', format: 1, exportedAt: new Date().toISOString(), scope: { tripId, title: String(trip.title ?? '') } }
  async function* source(): BackupSource {
    yield { table: 'trips', rows: [[trip!]] }
    for (const name of BACKUP_TABLES) {
      if (name === 'trips' || (!options.includeLarge && LARGE_TABLES.includes(name))) continue
      if (!db.table(name).schema.idxByName.tripId) continue // gehört zu keiner Reise (z. B. Aussehen)
      yield { table: name, rows: rowsOf(name, tripId) }
    }
  }
  const counted = BACKUP_TABLES.filter((n) => n !== 'trips' && (options.includeLarge || !LARGE_TABLES.includes(n)) && db.table(n).schema.idxByName.tripId)
  const onRow = await progressCounter(counted, options.onProgress, tripId)
  return { blob: await writeBackup(meta, source(), onRow), exportedAt: meta.exportedAt }
}

/** Ein Häppchen Datensätze einer Tabelle zusammenführen: neu → ergänzen, neuer → ersetzen */
async function mergeRows(name: string, rows: Record<string, unknown>[], stats: MergeStats): Promise<void> {
  if (!(BACKUP_TABLES as readonly string[]).includes(name) || !rows.length) return // unbekannte Tabelle (neuere App-Version)
  const table = db.table(name)
  const keyPath = table.schema.primKey.keyPath as string
  await db.transaction('rw', table, async () => {
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
  })
}

/**
 * Liest eine Sicherung oder eine geteilte Reise ein und führt sie mit den vorhandenen Daten zusammen:
 * Neues wird ergänzt, Vorhandenes nur ersetzt, wenn die eingelesene Fassung neuer ist.
 * Gelöschtes wird nicht übertragen (ein auf dem anderen Gerät gelöschter Eintrag bleibt hier erhalten).
 *
 * Die Datei wird Stück für Stück gelesen und in Häppchen gespeichert. Bricht es mittendrin ab,
 * ist der Teil davor schon da – ein zweiter Versuch ergänzt den Rest (nichts wird doppelt).
 *
 * `confirm` wird nach dem Kopf der Datei gefragt (z. B. „gehört zu einer anderen Reise – trotzdem?“);
 * gibt es false zurück, wird nichts eingelesen und `null` zurückgegeben.
 */
export async function importBackup(
  file: Blob,
  confirm?: (meta: BackupMeta) => boolean | Promise<boolean>,
  onProgress?: (fraction: number) => void
): Promise<{ meta: BackupMeta; stats: MergeStats } | null> {
  const stats = emptyStats()
  const CANCEL = new Error('abgebrochen')
  let meta: BackupMeta
  try {
    meta = await readBackup(
      file,
      (table, rows) => mergeRows(table, rows, stats),
      async (m) => {
        if (confirm && !(await confirm(m))) throw CANCEL
      },
      { onProgress }
    )
  } catch (e) {
    if (e === CANCEL) return null
    throw e
  } finally {
    // Beim nächsten Abgleich alles noch einmal vom Server holen: dort gelöschte Einträge, die mit der Sicherung
    // wieder hereingekommen sind, werden dann auch hier wieder entfernt (sonst lebten sie nur auf diesem Gerät weiter)
    if (stats.added + stats.updated && (await getMeta<number>('sync.lastSeq', 0))) await setMeta('sync.lastSeq', 0)
  }
  return { meta, stats }
}

/** Startet im Browser den Download einer Datei. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000) // große Dateien brauchen etwas, bis der Download angelaufen ist
}
