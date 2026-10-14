/**
 * Offline-Karten: Kartenausschnitte (Vektor-Kacheln, PMTiles) vom eigenen Server laden und auf dem Gerät
 * speichern. Die Karte wird dann ohne Internet gezeichnet (protomaps-leaflet).
 * Die Dateien bleiben nur auf diesem Gerät (werden nicht abgeglichen und nicht ins Backup gepackt).
 */
import { db } from '@/core/db'
import { ServerClient } from '@/core/sync/client'
import { requestPersistentStorage } from '@/core/storage'
import { N_, t, translated } from '@/core/i18n'

/** [West, Süd, Ost, Nord] in Grad */
export type Bbox = [number, number, number, number]

export interface OfflineMap {
  /** Kennung auf dem Server */
  id: string
  tripId: string
  name: string
  bbox: Bbox
  maxzoom: number
  size: number
  blob: Blob
  createdAt: string
}

export interface ServerMap {
  id: string
  name: string
  tripId?: string
  bbox: Bbox
  maxzoom: number
  status: 'läuft' | 'fertig' | 'fehler'
  size: number
  error: string
  created: string
}

export const DETAIL_LEVELS = translated([
  { zoom: 13, label: N_('Übersicht'), hint: N_('Straßen, Orte – kleinste Datei') },
  { zoom: 14, label: N_('Normal'), hint: N_('dazu Gebäude und Nebenstraßen') },
  { zoom: 15, label: N_('Wandern'), hint: N_('alle Wege und Hütten – größte Datei') }
] as const)

/** Größter Ausschnitt, den der Server annimmt (Grad je Richtung). */
export const MAX_SPAN = 3

/** Breite und Höhe eines Ausschnitts in km (ungefähr). */
export function bboxKm([w, s, e, n]: Bbox): { width: number; height: number } {
  const midLat = ((s + n) / 2) * (Math.PI / 180)
  return { width: Math.round((e - w) * 111.32 * Math.cos(midLat)), height: Math.round((n - s) * 110.57) }
}

export function bboxTooLarge([w, s, e, n]: Bbox): boolean {
  return e - w > MAX_SPAN || n - s > MAX_SPAN
}

/** Liegt der Punkt im Ausschnitt? */
export function covers([w, s, e, n]: Bbox, lat: number, lon: number): boolean {
  return lat >= s && lat <= n && lon >= w && lon <= e
}

/** Ausschnitt auf 5 Nachkommastellen und gültige Grenzen bringen. */
export function roundBbox([w, s, e, n]: Bbox): Bbox {
  const r = (v: number) => Math.round(v * 1e5) / 1e5
  return [r(Math.max(-180, w)), r(Math.max(-85, s)), r(Math.min(180, e)), r(Math.min(85, n))]
}

export function formatMb(bytes: number): string {
  return bytes >= 1024 * 1024 * 100 ? `${Math.round(bytes / 1024 / 1024)} MB` : `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`
}

export const offlineMapRepository = {
  listByTrip(tripId: string): Promise<OfflineMap[]> {
    return db.offlineMaps.where('tripId').equals(tripId).sortBy('createdAt')
  },
  async put(map: OfflineMap): Promise<void> {
    await db.offlineMaps.put(map)
  },
  async remove(id: string): Promise<void> {
    await db.offlineMaps.delete(id)
  },
  async removeByTrip(tripId: string): Promise<void> {
    await db.offlineMaps.where('tripId').equals(tripId).delete()
  }
}

/** Zugriff auf die Karten des eigenen Servers. */
export class MapsApi {
  constructor(private readonly client: ServerClient) {}

  static async create(): Promise<MapsApi | null> {
    const client = await ServerClient.fromSync()
    return client ? new MapsApi(client) : null
  }

  async list(): Promise<{ available: boolean; maps: ServerMap[] }> {
    return this.client.json('/api/maps')
  }

  order(name: string, tripId: string, bbox: Bbox, maxzoom: number): Promise<ServerMap> {
    return this.client.json('/api/maps', 'POST', { name, tripId, bbox, maxzoom })
  }

  get(id: string): Promise<ServerMap> {
    return this.client.json(`/api/maps/${id}`)
  }

  async remove(id: string): Promise<void> {
    await this.client.json(`/api/maps/${id}`, 'DELETE')
  }

  /** Wartet, bis der Server den Ausschnitt fertig hat (fragt alle 2 s nach). */
  async waitUntilReady(id: string, onTick?: (seconds: number) => void, signal?: AbortSignal): Promise<ServerMap> {
    const started = Date.now()
    for (;;) {
      const m = await this.get(id)
      if (m.status === 'fertig') return m
      if (m.status === 'fehler') throw new Error(m.error || t('Der Server konnte die Karte nicht erstellen.'))
      if (signal?.aborted) throw new Error(t('Abgebrochen.'))
      onTick?.(Math.round((Date.now() - started) / 1000))
      await new Promise((r) => setTimeout(r, 2000))
    }
  }

  /** Lädt die fertige Datei herunter; meldet den Fortschritt (0…1). */
  async download(map: ServerMap, onProgress?: (part: number) => void): Promise<Blob> {
    const res = await this.client.request(`/api/maps/${map.id}/datei`)
    const total = Number(res.headers.get('content-length')) || map.size || 0
    if (!res.body || !total) return res.blob()
    const reader = res.body.getReader()
    const chunks: Uint8Array[] = []
    let got = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      got += value.length
      onProgress?.(Math.min(1, got / total))
    }
    return new Blob(chunks as BlobPart[], { type: 'application/vnd.pmtiles' })
  }
}

/** Server-Karte auf dieses Gerät holen und speichern. */
export async function saveToDevice(api: MapsApi, map: ServerMap, tripId: string, onProgress?: (part: number) => void): Promise<OfflineMap> {
  const blob = await api.download(map, onProgress)
  const offline: OfflineMap = {
    id: map.id,
    tripId,
    name: map.name,
    bbox: map.bbox,
    maxzoom: map.maxzoom,
    size: blob.size,
    blob,
    createdAt: new Date().toISOString()
  }
  await offlineMapRepository.put(offline)
  // Große Dateien: den Browser bitten, sie nicht bei Platzmangel zu löschen
  void requestPersistentStorage().catch(() => false)
  return offline
}
