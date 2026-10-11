import { syncCredentials } from '@/core/sync/engine'
import type { PiwigoAlbum, PiwigoImage, PiwigoStatus } from './types'

/** Bildgrößen von Piwigo: small für Vorschauen, xxlarge zum Übernehmen. */
export type PiwigoSize = 'thumb' | 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge' | 'original'

/**
 * Zugriff auf Piwigo über den eigenen Abgleich-Server (Brücke unter /api/piwigo).
 * Die App spricht nie direkt mit Piwigo – der Server kennt den Piwigo-Schlüssel.
 */
export class PiwigoApi {
  constructor(
    private readonly server: string,
    private readonly key: string
  ) {}

  /** Mit den Zugangsdaten des Geräte-Abgleichs – oder null, wenn der Abgleich nicht eingerichtet ist. */
  static async fromSync(): Promise<PiwigoApi | null> {
    const c = await syncCredentials()
    return c ? new PiwigoApi(c.server, c.key) : null
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    let res: Response
    try {
      res = await fetch(`${this.server}/api/piwigo${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${this.key}`, ...(init.headers as Record<string, string>) }
      })
    } catch {
      throw new Error(navigator.onLine ? 'Server nicht erreichbar.' : 'Offline.')
    }
    if (!res.ok) {
      let msg = `Fehler ${res.status}`
      try {
        msg = (await res.clone().json()).error ?? msg
      } catch {
        /* keine JSON-Antwort */
      }
      if (res.status === 404 && path === '') msg = 'Piwigo ist auf dem Server nicht eingerichtet.'
      throw Object.assign(new Error(msg), { status: res.status })
    }
    return res
  }

  /** Ist Piwigo am Server eingerichtet? null = Server gerade nicht erreichbar. (Fragt Piwigo selbst nicht.) */
  async enabled(): Promise<boolean | null> {
    try {
      const res = await fetch(`${this.server}/api/info`, { headers: { Authorization: `Bearer ${this.key}` } })
      if (!res.ok) return null
      return (await res.json()).piwigo === true
    } catch {
      return null
    }
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
