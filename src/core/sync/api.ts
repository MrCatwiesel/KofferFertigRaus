import type { RemoteChange } from './logic'

/** Der Server kennt dieses Gerät nicht mehr (abgemeldet) oder die Gruppe ist gesperrt. */
export class DeviceRevokedError extends Error {
  constructor(
    message: string,
    readonly reason = ''
  ) {
    super(message)
  }
}

/** Gerät beim Server anmelden → eigener Gerätezugang. Mit Einladungscode (ohne Schlüssel) oder Gruppenschlüssel. */
export async function loginDevice(
  server: string,
  opts: { invite?: string; key?: string; name: string }
): Promise<{ token: string; device: { id: string; name: string }; group: string }> {
  let res: Response
  try {
    res = await fetch(`${server}/api/anmelden`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(opts.key ? { Authorization: `Bearer ${opts.key}` } : {}) },
      body: JSON.stringify(opts.invite ? { invite: opts.invite, name: opts.name } : { name: opts.name })
    })
  } catch {
    throw new Error(navigator.onLine ? 'Server nicht erreichbar – Adresse prüfen.' : 'Offline.')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? `Anmelden fehlgeschlagen (${res.status}).`)
  return body
}

/** Netzwerkzugriff auf den Abgleich-Server. */
/** Fehler mit HTTP-Status – 4xx bedeutet „dauerhaft“ (Wiederholen hilft nicht), z. B. Datei zu groß */
export class SyncHttpError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message)
  }
  get permanent(): boolean {
    return this.status >= 400 && this.status < 500 && this.status !== 408 && this.status !== 429
  }
}

export class SyncApi {
  constructor(
    private readonly server: string,
    private readonly key: string
  ) {}

  /** Zahl der hier noch nicht hochgeladenen Änderungen – geht mit, damit andere Geräte den Stand sehen */
  pending: number | null = null

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { Authorization: `Bearer ${this.key}`, ...(this.pending !== null ? { 'X-NWW-Pending': String(this.pending) } : {}), ...extra }
  }

  private async request(path: string, init: RequestInit = {}): Promise<Response> {
    let res: Response
    try {
      res = await fetch(`${this.server}${path}`, { ...init, headers: { ...this.headers(), ...(init.headers as Record<string, string>) } })
    } catch {
      throw new Error(navigator.onLine ? 'Server nicht erreichbar – Adresse prüfen.' : 'Offline.')
    }
    if (res.status === 401) {
      const body = await res.json().catch(() => ({}))
      if (body.code === 'abgemeldet' || body.code === 'gesperrt') throw new DeviceRevokedError(body.error, body.reason ?? '')
      throw new Error('Schlüssel wurde vom Server abgelehnt.')
    }
    if (res.status === 429) throw new Error('Zu viele Fehlversuche – bitte 15 Minuten warten.')
    return res
  }

  async info(): Promise<{ version: string; records: number; seq: number; epoch?: string; devices?: boolean; device?: { id: string; name: string } | null }> {
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
    if (!res.ok) throw new SyncHttpError(`Hochladen fehlgeschlagen (${res.status}).`, res.status)
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
    if (!res.ok) throw new SyncHttpError(res.status === 413 ? 'Datei zu groß für den Server.' : `Foto-Upload fehlgeschlagen (${res.status}).`, res.status)
  }

  async getBlob(hash: string): Promise<Blob> {
    const res = await this.request(`/api/blob/${hash}`)
    if (!res.ok) throw new SyncHttpError(`Foto konnte nicht geladen werden (${res.status}).`, res.status)
    return res.blob()
  }
}

/** SHA-256 einer Datei als Hex-Text. */
export async function hashBlob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}
