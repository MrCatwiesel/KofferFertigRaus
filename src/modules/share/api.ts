import { ServerClient } from '@/core/sync/client'
import type { ShareDraft, ShareLink } from './types'

/** Lese-Links auf dem eigenen Server verwalten. */
export class ShareApi {
  constructor(readonly client: ServerClient) {}

  static async fromSync(): Promise<ShareApi | null> {
    const c = await ServerClient.fromSync()
    return c ? new ShareApi(c) : null
  }

  get server(): string {
    return this.client.server
  }

  async list(tripId: string): Promise<ShareLink[]> {
    return (await this.client.json<{ shares: ShareLink[] }>(`/api/shares?tripId=${encodeURIComponent(tripId)}`)).shares
  }

  create(tripId: string, draft: ShareDraft): Promise<ShareLink> {
    return this.client.json<ShareLink>('/api/shares', 'POST', { tripId, ...draft, password: draft.password || undefined })
  }

  update(token: string, patch: Partial<ShareDraft> & { revoked?: boolean }): Promise<ShareLink> {
    return this.client.json<ShareLink>(`/api/shares/${token}`, 'PATCH', patch)
  }

  async remove(token: string): Promise<void> {
    await this.client.json(`/api/shares/${token}`, 'DELETE')
  }
}
