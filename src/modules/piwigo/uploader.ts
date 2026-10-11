import { reactive } from 'vue'
import { now } from '@/core/db'
import type { AddedPhoto } from '@/core/registry'
import { photoRepository } from '@/modules/journal/public'
import { tripRepository } from '@/modules/trip/public'
import { PiwigoApi } from './api'
import { albumNameFor, externalRef, findAlbumByName, isDue, retryDelayMs, uploadTitle } from './logic'
import { albumLinkRepository, piwigoPrefs, uploadRepository } from './repository'
import type { PiwigoAlbumLink } from './types'

/** Sichtbarer Zustand des Hochladens. */
export const uploadState = reactive({
  running: false,
  waiting: 0,
  current: '',
  lastError: ''
})

async function refreshCount() {
  uploadState.waiting = await uploadRepository.count()
}

/** Prüft, ob Piwigo am Server eingerichtet ist, und merkt es sich (für offline). */
export async function piwigoAvailable(): Promise<boolean> {
  const api = await PiwigoApi.fromSync()
  if (!api) return false
  const answer = navigator.onLine ? await api.enabled() : null
  if (answer !== null) {
    await piwigoPrefs.setEnabled(answer)
    return answer
  }
  // Server gerade nicht erreichbar: letzte bekannte Antwort
  return (await piwigoPrefs.enabled()) === true
}

/** Album der Reise holen – bei Bedarf ein vorhandenes gleichnamiges nehmen oder neu anlegen. */
export async function ensureAlbum(api: PiwigoApi, tripId: string): Promise<PiwigoAlbumLink> {
  const existing = await albumLinkRepository.get(tripId)
  if (existing) return existing
  const trip = await tripRepository.get(tripId)
  const name = albumNameFor(trip ?? { title: 'Reise' })
  const parent = await piwigoPrefs.parentAlbum()
  const albums = await api.albums()
  const found = findAlbumByName(albums, name, parent)
  if (found) return albumLinkRepository.set(tripId, { id: found.id, name: found.name, url: found.url })
  const created = await api.createAlbum(name, parent)
  const fresh = (await api.albums()).find((a) => a.id === created.id)
  return albumLinkRepository.set(tripId, { id: created.id, name: fresh?.name ?? created.name, url: fresh?.url ?? '' })
}

/** Neue eigene Fotos vormerken (nur wenn Piwigo genutzt wird und für die Reise nicht abgeschaltet). */
export async function queuePhotos(photos: AddedPhoto[]): Promise<void> {
  if (!photos.length || !(await piwigoAvailable())) return
  const items = []
  for (const p of photos) {
    const link = await albumLinkRepository.get(p.tripId)
    if (link && !link.autoUpload) continue
    items.push({ tripId: p.tripId, photoId: p.photoId, original: p.original, filename: p.filename, caption: p.caption, takenAt: p.takenAt })
  }
  if (!items.length) return
  await uploadRepository.add(items)
  await refreshCount()
  void processQueue()
}

function friendly(e: unknown): string {
  const err = e as { status?: number; message?: string }
  if (err.status === 413) return 'Foto zu groß – Upload-Grenze in Piwigo (PHP) oder im Proxy erhöhen.'
  return err.message || 'Unbekannter Fehler'
}

/** Warteschlange abarbeiten. `force` ignoriert Wartezeiten nach Fehlern. */
export async function processQueue(force = false): Promise<void> {
  if (uploadState.running || !navigator.onLine) return refreshCount()
  const api = await PiwigoApi.fromSync()
  if (!api) return refreshCount()
  uploadState.running = true
  uploadState.lastError = ''
  try {
    const all = await uploadRepository.listAll()
    if (!all.length) return
    if ((await api.enabled()) !== true) return
    const ts = now()
    for (const u of all) {
      if (!force && !isDue(u, ts)) continue
      const photo = await photoRepository.get(u.photoId)
      if (!photo || photo.externalRef) {
        await uploadRepository.done(u.id) // Foto gelöscht oder schon verknüpft
        continue
      }
      const link = await albumLinkRepository.get(u.tripId)
      if (link && !link.autoUpload && !force) continue
      uploadState.current = u.filename
      try {
        const album = link ?? (await ensureAlbum(api, u.tripId))
        const r = await api.upload(album.albumId, u.original, { filename: u.filename, name: uploadTitle(u.caption || photo.caption, u.filename) })
        await photoRepository.setExternal(u.photoId, externalRef(r.id), r.pageUrl ?? '')
        await uploadRepository.done(u.id)
      } catch (e) {
        const tries = u.tries + 1
        uploadState.lastError = friendly(e)
        await uploadRepository.failed(u.id, tries, uploadState.lastError, new Date(Date.now() + retryDelayMs(tries)).toISOString())
        if ((e as { status?: number }).status === undefined) break // Netz weg → später weiter
      }
      await refreshCount()
    }
  } finally {
    uploadState.running = false
    uploadState.current = ''
    await refreshCount()
  }
}

let started = false
/** Hintergrund: beim Start, wenn Netz zurückkommt, beim Zurückkehren in die App und alle 5 Minuten. */
export function startUploader(): void {
  if (started || typeof window === 'undefined') return
  started = true
  setTimeout(() => void processQueue(), 8000)
  window.addEventListener('online', () => void processQueue())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void processQueue()
  })
  setInterval(() => void processQueue(), 5 * 60_000)
}
