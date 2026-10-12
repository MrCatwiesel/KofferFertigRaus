import type { RemoteChange } from './logic'

/** Netzwerkzugriff auf den Abgleich-Server. */
export class SyncApi {
  constructor(
    private readonly server: string,
    private readonly key: string
  ) {}

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.key}`, ...extra }
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    let res: Response
    try {
      res = await fetch(`${this.server}${path}`, { ...init, headers: { ...this.headers(), ...(init.headers as Record<string, string>) } })
    } catch {
      throw new Error(navigator.onLine ? 'Server nicht erreichbar – Adresse prüfen.' : 'Offline.')
    }
    if (res.status === 401) throw new Error('Schlüssel wurde vom Server abgelehnt.')
    return res
  }

  async info(): Promise<{ version: string; records: number; seq: number; epoch?: string }> {
    const res = await this.request('/api/info')
    if (!res.ok) throw new Error(`Server antwortet mit Fehler ${res.status}.`)
    return res.json()
  }

  async push(changes: RemoteChange[]): Promise<{ accepted: number; ignored: number; seq: number }> {
    const res = await this.request('/api/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes })
    })
    if (!res.ok) throw new Error(`Hochladen fehlgeschlagen (${res.status}).`)
    return res.json()
  }

  async pull(since: number): Promise<{ changes: RemoteChange[]; more: boolean; seq: number }> {
    const res = await this.request(`/api/pull?since=${since}&limit=300`)
    if (!res.ok) throw new Error(`Abholen fehlgeschlagen (${res.status}).`)
    return res.json()
  }

  async hasBlob(hash: string): Promise<boolean> {
    const res = await this.request(`/api/blob/${hash}`, { method: 'HEAD' })
    return res.ok
  }

  async putBlob(hash: string, blob: Blob): Promise<void> {
    const res = await this.request(`/api/blob/${hash}`, { method: 'PUT', headers: { 'Content-Type': blob.type || 'application/octet-stream' }, body: blob })
    if (!res.ok) throw new Error(`Foto-Upload fehlgeschlagen (${res.status}).`)
  }

  async getBlob(hash: string): Promise<Blob> {
    const res = await this.request(`/api/blob/${hash}`)
    if (!res.ok) throw new Error(`Foto konnte nicht geladen werden (${res.status}).`)
    return res.blob()
  }
}

/** SHA-256 einer Datei als Hex-Text. */
export async function hashBlob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
