/**
 * Dateiformat der Sicherung – ohne Datenbank, damit es sich einzeln testen lässt.
 *
 * Die Datei ist gewöhnliches JSON, aber zeilenweise aufgebaut: Kopf, je Tabelle eine Zeile
 * mit dem Namen und je Datensatz eine Zeile. So lässt sie sich Stück für Stück schreiben und
 * lesen. Vorher entstand die ganze Datei als ein einziger Text: mit vielen Fotos (einige hundert MB)
 * scheiterte das an der Höchstlänge für Texte im Browser bzw. am Arbeitsspeicher des iPads.
 *
 *   {"app":"koffer-fertig-raus","format":1,"exportedAt":"…","tables":{
 *   "trips":[
 *   {…}
 *   ,{…}
 *   ]
 *   ,"photos":[
 *   {…, "full":{"__blob":"data:image/jpeg;base64,…"}}
 *   ]
 *   }}
 *
 * Ältere Dateien (alles in einer Zeile) werden weiterhin gelesen.
 */
import { safeBlobType } from './blob-types'
import { t } from '@/i18n'

export interface BackupMeta {
  /** Früher hieß die App „Nix wie weg“ – solche Dateien werden weiter gelesen */
  app: 'koffer-fertig-raus' | 'nix-wie-weg'
  format: 1
  exportedAt: string
  /** Gesetzt, wenn nur eine einzelne Reise geteilt wurde */
  scope?: { tripId: string; title: string }
}

export interface BackupFile extends BackupMeta {
  tables: Record<string, unknown[]>
}

/** Platzhalter für eine Binärdatei (Foto) im JSON. */
interface EncodedBlob {
  __blob: string
}

const NOT_OURS = t('Das ist keine Datei von „KofferFertigRaus“.')

function checkMeta(m: Partial<BackupMeta> | null | undefined): asserts m is BackupMeta {
  if ((m?.app !== 'koffer-fertig-raus' && m?.app !== 'nix-wie-weg') || m.format !== 1) throw new Error(NOT_OURS)
}

/** Bytes → base64, in Stücken (ein großes Foto auf einmal sprengt sonst den Aufrufstapel) */
function bytesToBase64(bytes: Uint8Array): string {
  const parts: string[] = []
  const STEP = 3 * 8190 // durch 3 teilbar → keine Füllzeichen mitten im Text
  for (let i = 0; i < bytes.length; i += STEP) parts.push(btoa(String.fromCharCode(...bytes.subarray(i, i + STEP))))
  return parts.join('')
}

export async function blobToDataUrl(blob: Blob): Promise<string> {
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(r.error)
      r.readAsDataURL(blob)
    })
  }
  return `data:${blob.type || 'application/octet-stream'};base64,${bytesToBase64(new Uint8Array(await blob.arrayBuffer()))}`
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
export async function encodeRow(row: Record<string, unknown>): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = { ...row }
  for (const [k, v] of Object.entries(row)) {
    if (v instanceof Blob) out[k] = { __blob: await blobToDataUrl(v) } satisfies EncodedBlob
  }
  return out
}

export function decodeRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row }
  for (const [k, v] of Object.entries(row)) {
    if (v && typeof v === 'object' && typeof (v as EncodedBlob).__blob === 'string') out[k] = dataUrlToBlob((v as EncodedBlob).__blob)
  }
  return out
}

/**
 * Sammelt Text in einem Blob. Fasst regelmäßig zusammen, damit die Fotos nicht alle
 * gleichzeitig als Text im Arbeitsspeicher liegen (der Browser lagert Blobs bei Bedarf aus).
 */
class BlobWriter {
  private parts: BlobPart[] = []
  private pending = 0
  private acc: Blob | null = null
  write(s: string) {
    this.parts.push(s)
    this.pending += s.length
    if (this.pending > 8_000_000) this.flush()
  }
  private flush() {
    if (!this.parts.length) return
    this.acc = new Blob(this.acc ? [this.acc, ...this.parts] : this.parts)
    this.parts = []
    this.pending = 0
  }
  finish(type: string): Blob {
    this.flush()
    return new Blob(this.acc ? [this.acc] : [], { type })
  }
}

/** Eine Tabelle für die Sicherung: Name und die Datensätze (gern stückweise) */
export type BackupSource = AsyncIterable<{ table: string; rows: AsyncIterable<Record<string, unknown>[]> | Iterable<Record<string, unknown>[]> }>

/** Schreibt die Sicherungsdatei Zeile für Zeile */
export async function writeBackup(meta: BackupMeta, source: BackupSource, onRow?: () => void): Promise<Blob> {
  const w = new BlobWriter()
  w.write(JSON.stringify(meta).slice(0, -1) + ',"tables":{\n')
  let firstTable = true
  for await (const { table, rows } of source) {
    w.write(`${firstTable ? '' : ','}${JSON.stringify(table)}:[\n`)
    firstTable = false
    let firstRow = true
    for await (const chunk of rows) {
      for (const row of chunk) {
        w.write(`${firstRow ? '' : ','}${JSON.stringify(await encodeRow(row))}\n`)
        firstRow = false
        onRow?.()
      }
    }
    w.write(']\n')
  }
  w.write('}}\n')
  return w.finish('application/json')
}

/** Zeilen aus einer Datei lesen, ohne sie ganz in den Speicher zu laden */
export async function* readLines(blob: Blob, onBytes?: (read: number) => void): AsyncGenerator<string> {
  const reader = blob.stream().getReader()
  const dec = new TextDecoder()
  let rest = ''
  let read = 0
  for (;;) {
    const { value, done } = await reader.read()
    if (value) onBytes?.((read += value.length))
    rest += done ? dec.decode() : dec.decode(value, { stream: true })
    let nl: number
    while ((nl = rest.indexOf('\n')) >= 0) {
      yield rest.slice(0, nl).replace(/\r$/, '')
      rest = rest.slice(nl + 1)
    }
    if (done) break
  }
  if (rest) yield rest
}

export interface ReadOptions {
  /** Höchstens so viele Datensätze auf einmal weitergeben */
  maxRows?: number
  /** … bzw. höchstens so viele Zeichen (Fotos sind groß) */
  maxChars?: number
  /** Fortschritt 0…1 (gelesener Anteil der Datei) */
  onProgress?: (fraction: number) => void
}

/**
 * Liest eine Sicherung und gibt die Datensätze tabellenweise in Häppchen weiter (Blobs schon zurückverwandelt).
 * `onMeta` wird vor dem ersten Datensatz aufgerufen – dort darf auch abgebrochen werden (Fehler werfen).
 */
export async function readBackup(
  file: Blob,
  onRows: (table: string, rows: Record<string, unknown>[]) => Promise<void>,
  onMeta: (meta: BackupMeta) => void | Promise<void> = () => {},
  opts: ReadOptions = {}
): Promise<BackupMeta> {
  const maxRows = opts.maxRows ?? 200
  const maxChars = opts.maxChars ?? 20_000_000
  const lines = readLines(file, opts.onProgress && file.size ? (n) => opts.onProgress!(Math.min(1, n / file.size)) : undefined)
  const first = await lines.next()
  const head = first.done ? '' : first.value

  // Ältere Datei: alles in einem Stück
  if (!(head.startsWith('{"app":') && head.endsWith('"tables":{'))) {
    let file1: BackupFile
    try {
      file1 = JSON.parse(await file.text()) as BackupFile
    } catch {
      throw new Error(NOT_OURS)
    }
    checkMeta(file1)
    const { tables, ...meta } = file1
    await onMeta(meta)
    for (const [table, rows] of Object.entries(tables ?? {})) {
      if (!Array.isArray(rows)) continue
      for (let i = 0; i < rows.length; i += maxRows) await onRows(table, (rows.slice(i, i + maxRows) as Record<string, unknown>[]).map(decodeRow))
    }
    return meta
  }

  const meta = JSON.parse(head + '}}') as BackupMeta
  checkMeta(meta)
  await onMeta(meta)
  let table: string | null = null
  let buf: Record<string, unknown>[] = []
  let chars = 0
  let complete = false
  const flush = async () => {
    if (table && buf.length) await onRows(table, buf)
    buf = []
    chars = 0
  }
  for await (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    if (line === '}}') {
      complete = true
      break
    }
    if (line === ']') {
      await flush()
      table = null
      continue
    }
    const start = /^,?("(?:[^"\\]|\\.)*"):\[$/.exec(line)
    if (start) {
      await flush()
      table = JSON.parse(start[1]) as string
      continue
    }
    if (!table) throw new Error(t('Die Datei ist beschädigt.'))
    buf.push(decodeRow(JSON.parse(line.startsWith(',') ? line.slice(1) : line) as Record<string, unknown>))
    chars += line.length
    if (buf.length >= maxRows || chars >= maxChars) await flush()
  }
  await flush()
  if (!complete) throw new Error(t('Die Datei ist unvollständig (abgeschnitten?). Was bis dahin drinstand, wurde übernommen.'))
  return meta
}
