import { syncCredentials } from './engine'
import { t } from '@/i18n'

/** Was der eigene Server über sich und die Reisegruppe sagt (GET /api/info). */
export interface ServerInfo {
  ok: boolean
  version: string
  records: number
  seq: number
  /** Kennung des Datenbestands (neu nach Wiederherstellung einer Sicherung) */
  epoch?: string
  /** Piwigo eingerichtet und für diese Gruppe freigegeben */
  piwigo: boolean
  /** Name der Reisegruppe */
  group?: string
  /** Besitzer des Servers (darf Reisegruppen verwalten) */
  admin?: boolean
  /** Verwalter der Gruppe (oder Gerät ohne Person) */
  manager?: boolean
  /** Server kann Lese-Links */
  shares?: boolean
  /** Server kann Offline-Karten erstellen (Programm pmtiles vorhanden) */
  maps?: boolean
  /** Server kennt eigene Gerätezugänge (Anmelden, Einladungen, Abmelden) */
  devices?: boolean
  /** Dieses Gerät (bei Anmeldung mit Gerätezugang) */
  device?: { id: string; name: string } | null
}

export type ServerError = Error & { status?: number; needPassword?: boolean; detail?: string }

/**
 * Zugriff auf Zusatzdienste des eigenen Servers (Lese-Links, Reisegruppen, Piwigo)
 * mit den Zugangsdaten des Geräte-Abgleichs. Fehler kommen als verständliche Meldung zurück.
 */
export class ServerClient {
  constructor(
    readonly server: string,
    private readonly key: string
  ) {}

  /** Mit den Zugangsdaten des Abgleichs – oder null, wenn er nicht eingerichtet ist. */
  static async fromSync(): Promise<ServerClient | null> {
    const c = await syncCredentials()
    return c ? new ServerClient(c.server, c.key) : null
  }

  async request(path: string, init: RequestInit = {}): Promise<Response> {
    let res: Response
    try {
      res = await fetch(`${this.server}${path}`, {
        ...init,
        headers: { Authorization: `Bearer ${this.key}`, ...(init.headers as Record<string, string>) }
      })
    } catch {
      throw new Error(navigator.onLine ? t('Server nicht erreichbar.') : t('Offline.'))
    }
    if (!res.ok) {
      let msg = t('Fehler {status}', { status: res.status })
      let detail: string | undefined
      try {
        const body = await res.clone().json()
        if (typeof body.error === 'string' && body.error) msg = t(body.error)
        if (typeof body.detail === 'string' && body.detail) detail = body.detail
      } catch {
        /* keine JSON-Antwort */
      }
      throw Object.assign(new Error(msg), { status: res.status, detail }) as ServerError
    }
    return res
  }

  async json<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
    const res = await this.request(path, {
      method,
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    })
    return res.json() as Promise<T>
  }

  /** Infos zur Gruppe; null = Server gerade nicht erreichbar. */
  async info(): Promise<ServerInfo | null> {
    try {
      return await this.json<ServerInfo>('/api/info')
    } catch {
      return null
    }
  }
}
