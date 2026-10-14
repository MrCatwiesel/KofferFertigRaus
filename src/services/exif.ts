/**
 * Aufnahmeort und -zeit aus den EXIF-Daten eines Fotos lesen (JPEG, auch HEIC/TIFF).
 * Selbst geschrieben und klein: nur GPS-Position, Höhe und Aufnahmezeit.
 *
 * Wichtig: Die App verkleinert Fotos über ein Canvas – dabei gehen die EXIF-Daten verloren.
 * Deshalb muss die Originaldatei gelesen werden, bevor sie verkleinert wird.
 */

export interface ExifInfo {
  lat?: number
  lon?: number
  /** Meter über dem Meer */
  ele?: number
  /** Aufnahmezeit als ISO-Zeitstempel (UTC) */
  takenAt?: string
}

const TAG = {
  exifIfd: 0x8769,
  gpsIfd: 0x8825,
  dateTimeOriginal: 0x9003,
  offsetTimeOriginal: 0x9011,
  gpsLatRef: 1,
  gpsLat: 2,
  gpsLonRef: 3,
  gpsLon: 4,
  gpsAltRef: 5,
  gpsAlt: 6
} as const

const SIZES: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 }

type Value = number[] | string

/** Liest die EXIF-Angaben einer Datei; `null`, wenn keine (brauchbaren) vorhanden sind. */
export async function readExif(file: Blob): Promise<ExifInfo | null> {
  try {
    // JPEG: EXIF steht am Anfang. Andere Formate (HEIC) ganz lesen.
    const head = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer())
    let info = parseExif(head)
    if (!info && !(head[0] === 0xff && head[1] === 0xd8) && file.size > head.length && file.size < 60 * 1024 * 1024) {
      info = parseExif(new Uint8Array(await file.arrayBuffer()))
    }
    return info
  } catch {
    return null
  }
}

/** EXIF aus Bytes (ganze Datei oder ihr Anfang) */
export function parseExif(bytes: Uint8Array): ExifInfo | null {
  const start = findTiff(bytes)
  if (start < 0) return null
  const view = new DataView(bytes.buffer, bytes.byteOffset + start, bytes.length - start)
  const little = view.getUint16(0) === 0x4949
  if (view.getUint16(2, little) !== 42) return null
  const u16 = (o: number) => view.getUint16(o, little)
  const u32 = (o: number) => view.getUint32(o, little)

  /** Ein Verzeichnis (IFD) lesen: Tag → Wert */
  const readIfd = (offset: number): Map<number, Value> => {
    const out = new Map<number, Value>()
    if (offset <= 0 || offset + 2 > view.byteLength) return out
    const n = u16(offset)
    for (let i = 0; i < n && i < 500; i++) {
      const e = offset + 2 + i * 12
      if (e + 12 > view.byteLength) break
      const tag = u16(e)
      const type = u16(e + 2)
      const count = u32(e + 4)
      const size = SIZES[type]
      if (!size || count > 1000) continue
      const at = size * count <= 4 ? e + 8 : u32(e + 8)
      if (at + size * count > view.byteLength) continue
      if (type === 2) {
        let s = ''
        for (let k = 0; k < count; k++) {
          const c = view.getUint8(at + k)
          if (!c) break
          s += String.fromCharCode(c)
        }
        out.set(tag, s)
        continue
      }
      const vals: number[] = []
      for (let k = 0; k < count; k++) {
        const o = at + k * size
        if (type === 1 || type === 7) vals.push(view.getUint8(o))
        else if (type === 3) vals.push(u16(o))
        else if (type === 4) vals.push(u32(o))
        else if (type === 9) vals.push(view.getInt32(o, little))
        else if (type === 5) vals.push(u32(o + 4) ? u32(o) / u32(o + 4) : NaN)
        else if (type === 10) {
          const d = view.getInt32(o + 4, little)
          vals.push(d ? view.getInt32(o, little) / d : NaN)
        }
      }
      out.set(tag, vals)
    }
    return out
  }

  const ifd0 = readIfd(u32(4))
  const num = (v: Value | undefined) => (Array.isArray(v) ? v[0] : undefined)
  const info: ExifInfo = {}

  const gpsAt = num(ifd0.get(TAG.gpsIfd))
  if (gpsAt) {
    const gps = readIfd(gpsAt)
    const dms = (v: Value | undefined) => (Array.isArray(v) && v.length >= 1 ? (v[0] ?? 0) + (v[1] ?? 0) / 60 + (v[2] ?? 0) / 3600 : NaN)
    const lat = dms(gps.get(TAG.gpsLat)) * (String(gps.get(TAG.gpsLatRef) ?? 'N').toUpperCase().startsWith('S') ? -1 : 1)
    const lon = dms(gps.get(TAG.gpsLon)) * (String(gps.get(TAG.gpsLonRef) ?? 'E').toUpperCase().startsWith('W') ? -1 : 1)
    // 0/0 schreiben manche Kameras, wenn sie keinen Empfang hatten
    if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0)) {
      info.lat = Math.round(lat * 1e6) / 1e6
      info.lon = Math.round(lon * 1e6) / 1e6
      const alt = num(gps.get(TAG.gpsAlt))
      if (alt !== undefined && Number.isFinite(alt)) info.ele = Math.round(alt * (num(gps.get(TAG.gpsAltRef)) === 1 ? -1 : 1))
    }
  }

  const exifAt = num(ifd0.get(TAG.exifIfd))
  if (exifAt) {
    const ex = readIfd(exifAt)
    const t = exifTime(ex.get(TAG.dateTimeOriginal), ex.get(TAG.offsetTimeOriginal))
    if (t) info.takenAt = t
  }
  return info.lat !== undefined || info.takenAt ? info : null
}

/** „2026:10:05 14:32:10“ (+ „+02:00“) → ISO. Ohne Zeitzone gilt die Uhr des Geräts. */
export function exifTime(v: Value | undefined, offset?: Value): string | undefined {
  if (typeof v !== 'string') return undefined
  const m = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(v.trim())
  if (!m || m[1] === '0000') return undefined
  const [y, mo, d, h, mi, s] = m.slice(1).map(Number)
  const off = typeof offset === 'string' ? /^([+-])(\d{2}):?(\d{2})$/.exec(offset.trim()) : null
  const date = off
    ? new Date(Date.UTC(y, mo - 1, d, h, mi, s) - (off[1] === '-' ? -1 : 1) * (Number(off[2]) * 60 + Number(off[3])) * 60_000)
    : new Date(y, mo - 1, d, h, mi, s)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

/** Anfang der TIFF-Daten finden: JPEG-APP1-Abschnitt, sonst nach „Exif\0\0“ suchen (HEIC), sonst reine TIFF-Datei */
function findTiff(b: Uint8Array): number {
  const isTiff = (i: number) => i + 8 <= b.length && ((b[i] === 0x49 && b[i + 1] === 0x49 && b[i + 2] === 42 && b[i + 3] === 0) || (b[i] === 0x4d && b[i + 1] === 0x4d && b[i + 2] === 0 && b[i + 3] === 42))
  const exifAt = (i: number) => b[i] === 0x45 && b[i + 1] === 0x78 && b[i + 2] === 0x69 && b[i + 3] === 0x66 && b[i + 4] === 0 && b[i + 5] === 0
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2
    while (i + 4 <= b.length && b[i] === 0xff) {
      const marker = b[i + 1]
      const len = (b[i + 2] << 8) | b[i + 3]
      if (marker === 0xe1 && exifAt(i + 4) && isTiff(i + 10)) return i + 10
      if (marker === 0xda || len < 2) break // Bilddaten beginnen – kein EXIF mehr
      i += 2 + len
    }
    return -1
  }
  if (isTiff(0)) return 0
  for (let i = 0; i + 14 < b.length; i++) if (b[i] === 0x45 && exifAt(i) && isTiff(i + 6)) return i + 6
  return -1
}
