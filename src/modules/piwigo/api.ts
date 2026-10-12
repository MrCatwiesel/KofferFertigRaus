import { ServerClient, type ServerError } from '@/core/sync/client'
import type { PiwigoAlbum, PiwigoImage, PiwigoStatus } from './types'

/** Bildgrößen von Piwigo: small für Vorschauen, xxlarge zum Übernehmen. */
export type PiwigoSize = 'thumb' | 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge' | 'original'

/**
 * Zugriff auf Piwigo über den eigenen Abgleich-Server (Brücke unter /api/piwigo).
 * Die App spricht nie direkt mit Piwigo – der Server kennt den Piwigo-Schlüssel.
 */
export class PiwigoApi {
  constructor(private readonly client: ServerClient) {}

  /** Mit den Zugangsdaten des Geräte-Abgleichs – oder null, wenn der Abgleich nicht eingerichtet ist. */
  static async fromSync(): Promise<PiwigoApi | null> {
    const c = await ServerClient.fromSync()
    return c ? new PiwigoApi(c) : null
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await this.client.request(`/api/piwigo${path}`, init)
    } catch (e) {
      const err = e as ServerError
      if (err.status === 404 && path === '') err.message = 'Piwigo ist auf dem Server nicht eingerichtet.'
      if (err.status === 403) err.message = 'Piwigo ist für diese Reisegruppe nicht freigegeben.'
      throw err
    }
  }

  /** Ist Piwigo am Server eingerichtet und für diese Gruppe freigegeben? null = Server gerade nicht erreichbar. */
  async enabled(): Promise<boolean | null> {
    const info = await this.client.info()
    return info ? info.piwigo === true : null
  }

  async status(): Promise<PiwigoStatus> {
    return (await this.request('')).json()
  }

  async albums(): Promise<PiwigoAlbum[]> {
    return (await (await this.request('/albums')).json()).albums
  }

  async createAlbum(name: string, parentId: number | null): Promise<{ id: number; name: string }> {
    const res = await this.request('/albums', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId })
    })
    return res.json()
  }

  async images(albumId: number, page = 0, perPage = 60): Promise<{ images: PiwigoImage[]; page: number; perPage: number; total: number }> {
    return (await this.request(`/albums/${albumId}/images?page=${page}&perPage=${perPage}`)).json()
  }

  async imageBlob(imageId: number, size: PiwigoSize, signal?: AbortSignal): Promise<Blob> {
    return (await this.request(`/images/${imageId}?size=${size}`, { signal })).blob()
  }

  async upload(
    albumId: number,
    file: Blob,
    meta: { filename: string; name: string }
  ): Promise<{ id: number; existed: boolean; pageUrl?: string }> {
    const q = new URLSearchParams({ filename: meta.filename, name: meta.name })
    const res = await this.request(`/albums/${albumId}/images?${q}`, {
      method: 'POST',
      headers: { 'Content-Type': file.type && file.type.startsWith('image/') ? file.type : 'image/jpeg' },
      body: file
    })
    return res.json()
  }
}
