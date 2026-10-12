import type { ParsedRoute, RouteKind, TrackPoint } from '../types'

/**
 * FIT – das Originalformat von Garmin-Geräten (Fenix, Edge, GPSMap …).
 * Gelesen werden nur die Punkte (Nachricht "record") und die Dateiart (Aktivität oder Strecke).
 * Spezifikation: Garmin FIT SDK (öffentlich).
 */

const FIT_EPOCH = 631065600 // 1989-12-31T00:00:00Z in Sekunden seit 1970
const SEMI_TO_DEG = 180 / 2 ** 31

const MSG_FILE_ID = 0
const MSG_RECORD = 20
const MSG_COURSE = 31

interface FieldDef {
  num: number
  size: number
  base: number
}
interface Definition {
  global: number
  little: boolean
  fields: FieldDef[]
  devSize: number
}

/** Liest einen Wert; null bei "ungültig" laut FIT-Spezifikation. */
function readValue(view: DataView, off: number, f: FieldDef, little: boolean): number | null {
  switch (f.base & 0x1f) {
    case 0x00: // enum
    case 0x02: {
      // uint8
      const v = view.getUint8(off)
      return v === 0xff ? null : v
    }
    case 0x01: {
      const v = view.getInt8(off)
      return v === 0x7f ? null : v
    }
    case 0x03: {
      if (f.size < 2) return null
      const v = view.getInt16(off, little)
      return v === 0x7fff ? null : v
    }
    case 0x04: {
      if (f.size < 2) return null
      const v = view.getUint16(off, little)
      return v === 0xffff ? null : v
    }
    case 0x05: {
      if (f.size < 4) return null
      const v = view.getInt32(off, little)
      return v === 0x7fffffff ? null : v
    }
    case 0x06: {
      if (f.size < 4) return null
      const v = view.getUint32(off, little)
      return v === 0xffffffff ? null : v
    }
    default:
      return null
  }
}

export function isFit(bytes: Uint8Array): boolean {
  return bytes.length >= 12 && bytes[8] === 0x2e && bytes[9] === 0x46 && bytes[10] === 0x49 && bytes[11] === 0x54 // ".FIT"
}

export function parseFit(bytes: Uint8Array, fallbackName: string): ParsedRoute[] {
  if (!isFit(bytes)) throw new Error('Keine gültige FIT-Datei.')
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const headerSize = bytes[0]
  const dataSize = view.getUint32(4, true)
  const end = Math.min(bytes.length, headerSize + dataSize)
  const defs = new Map<number, Definition>()
  const points: TrackPoint[] = []
  let lastTimestamp = 0
  let kind: RouteKind = 'track'
  let courseName = ''
  let off = headerSize

  while (off < end) {
    const h = bytes[off++]

    // Definitions-Nachricht
    if ((h & 0x80) === 0 && h & 0x40) {
      const local = h & 0x0f
      const hasDev = (h & 0x20) !== 0
      const little = bytes[off + 1] === 0
      const global = little ? view.getUint16(off + 2, true) : view.getUint16(off + 2, false)
      const n = bytes[off + 4]
      off += 5
      const fields: FieldDef[] = []
      for (let i = 0; i < n; i++, off += 3) fields.push({ num: bytes[off], size: bytes[off + 1], base: bytes[off + 2] })
      let devSize = 0
      if (hasDev) {
        const nd = bytes[off++]
        for (let i = 0; i < nd; i++, off += 3) devSize += bytes[off + 1]
      }
      defs.set(local, { global, little, fields, devSize })
      continue
    }

    // Daten-Nachricht (normal oder mit komprimierter Zeit)
    let local: number
    let timestamp: number | null = null
    if (h & 0x80) {
      local = (h >> 5) & 0x03
      const offset = h & 0x1f
      timestamp = (lastTimestamp & ~0x1f) + offset
      if (offset < (lastTimestamp & 0x1f)) timestamp += 0x20
      lastTimestamp = timestamp
    } else {
      local = h & 0x0f
    }
    const def = defs.get(local)
    if (!def) throw new Error('FIT-Datei beschädigt (unbekannte Nachricht).')

    let lat: number | null = null
    let lon: number | null = null
    let alt: number | null = null
    let altEnh: number | null = null
    let fileType: number | null = null
    let name = ''
    for (const f of def.fields) {
      if (off + f.size > bytes.length) break
      if (def.global === MSG_COURSE && f.num === 5 && (f.base & 0x1f) === 0x07) {
        name = new TextDecoder().decode(bytes.subarray(off, off + f.size)).replace(/\0[\s\S]*$/, '')
      } else if (f.num === 253) {
        const t = readValue(view, off, f, def.little)
        if (t !== null) {
          timestamp = t
          lastTimestamp = t
        }
      } else if (def.global === MSG_RECORD) {
        if (f.num === 0) lat = readValue(view, off, f, def.little)
        else if (f.num === 1) lon = readValue(view, off, f, def.little)
        else if (f.num === 2) alt = readValue(view, off, f, def.little)
        else if (f.num === 78) altEnh = readValue(view, off, f, def.little)
      } else if (def.global === MSG_FILE_ID && f.num === 0) {
        fileType = readValue(view, off, f, def.little)
      }
      off += f.size
    }
    off += def.devSize

    if (def.global === MSG_FILE_ID && fileType === 6) kind = 'route' // Strecke (Course)
    if (def.global === MSG_COURSE && name) courseName = name
    if (def.global === MSG_RECORD && lat !== null && lon !== null) {
      const la = lat * SEMI_TO_DEG
      const lo = lon * SEMI_TO_DEG
      if (Math.abs(la) <= 90 && Math.abs(lo) <= 180 && !(la === 0 && lo === 0)) {
        const a = altEnh ?? alt
        points.push([la, lo, a === null ? null : Math.round((a / 5 - 500) * 10) / 10, timestamp === null ? null : timestamp + FIT_EPOCH])
      }
    }
  }

  return points.length >= 2 ? [{ name: courseName || fallbackName, kind, points }] : []
}
