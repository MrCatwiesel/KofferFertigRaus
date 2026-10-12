import type { FileFormat, ParsedRoute } from '../types'
import { isFit, parseFit } from './fit'
import { parseGeoJson } from './geojson'
import { parseGpx } from './gpx'
import { parseKml } from './kml'
import { parseTcx } from './tcx'

export const ACCEPT = '.gpx,.fit,.tcx,.kml,.kmz,.geojson,.json'

/**
 * Vorschlag für den Routennamen aus dem Dateinamen. Garmin benennt Aktivitäten nach Datum und Zeit
 * ("2026-07-05-08-00-00.fit") – daraus wird "Aktivität vom 05.07.2026".
 */
export function baseName(filename: string): string {
  const name = filename.replace(/\.[^.]+$/, '').trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[-_ T]\d{2}[-_:]?\d{2}(?:[-_:]?\d{2})?)?$/.exec(name)
  if (m) return `Aktivität vom ${m[3]}.${m[2]}.${m[1]}`
  return name.replace(/[_]+/g, ' ').trim() || 'Route'
}

/** Liest das erste KML aus einer KMZ-Datei (ZIP). */
export async function unzipKml(bytes: Uint8Array): Promise<string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  // Ende des Zentralverzeichnisses suchen
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('KMZ-Datei beschädigt.')
  const count = view.getUint16(eocd + 10, true)
  let p = view.getUint32(eocd + 16, true)
  const entries: { name: string; method: number; size: number; local: number }[] = []
  for (let i = 0; i < count && view.getUint32(p, true) === 0x02014b50; i++) {
    const nameLen = view.getUint16(p + 28, true)
    entries.push({
      method: view.getUint16(p + 10, true),
      size: view.getUint32(p + 20, true),
      local: view.getUint32(p + 42, true),
      name: new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen))
    })
    p += 46 + nameLen + view.getUint16(p + 30, true) + view.getUint16(p + 32, true)
  }
  const kmls = entries.filter((e) => /\.kml$/i.test(e.name))
  const entry = kmls.find((e) => /(^|\/)doc\.kml$/i.test(e.name)) ?? kmls[0]
  if (!entry) throw new Error('In der KMZ-Datei ist keine KML-Datei.')
  const start = entry.local + 30 + view.getUint16(entry.local + 26, true) + view.getUint16(entry.local + 28, true)
  const data = bytes.subarray(start, start + entry.size)
  if (entry.method === 0) return new TextDecoder().decode(data)
  if (entry.method !== 8) throw new Error('KMZ: unbekannte Kompression.')
  const stream = new Blob([new Uint8Array(data)]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Response(stream).text()
}

/** Format an Endung und Inhalt erkennen. */
export function detectFormat(filename: string, bytes: Uint8Array): FileFormat | null {
  if (isFit(bytes)) return 'fit'
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return 'kmz'
  const head = new TextDecoder().decode(bytes.subarray(0, 2000)).replace(/^﻿/, '').trimStart()
  if (/<gpx\b/i.test(head)) return 'gpx'
  if (/<kml\b/i.test(head)) return 'kml'
  if (/<TrainingCenterDatabase\b/i.test(head)) return 'tcx'
  if (head.startsWith('{')) return 'geojson'
  const ext = filename.toLowerCase().split('.').pop()
  if (ext === 'gpx' || ext === 'kml' || ext === 'tcx' || ext === 'kmz' || ext === 'fit') return ext
  if (ext === 'geojson' || ext === 'json') return 'geojson'
  return null
}

/** Liest eine Routendatei; eine Datei kann mehrere Routen enthalten. */
export async function parseRouteFile(filename: string, bytes: Uint8Array): Promise<{ format: FileFormat; routes: ParsedRoute[] }> {
  const format = detectFormat(filename, bytes)
  if (!format) throw new Error(`${filename}: Format nicht erkannt (GPX, FIT, TCX, KML, KMZ oder GeoJSON).`)
  const name = baseName(filename)
  const text = () => new TextDecoder().decode(bytes)
  let routes: ParsedRoute[]
  switch (format) {
    case 'fit':
      routes = parseFit(bytes, name)
      break
    case 'gpx':
      routes = parseGpx(text(), name)
      break
    case 'kml':
      routes = parseKml(text(), name)
      break
    case 'kmz':
      routes = parseKml(await unzipKml(bytes), name)
      break
    case 'tcx':
      routes = parseTcx(text(), name)
      break
    case 'geojson':
      routes = parseGeoJson(text(), name)
      break
  }
  if (!routes.length) throw new Error(`${filename}: keine Strecke gefunden (nur Wegpunkte?).`)
  return { format, routes }
}
