import type { Server } from 'node:http'
export const VERSION: string
export function spaceOf(key: string): string
export function createSyncServer(opts: {
  keys: string[]
  dataDir: string
  origins?: string[]
  maxBlobMb?: number
  piwigo?: { url: string; keyId: string; secret: string; publicUrl?: string; fetchImpl?: typeof fetch } | null
}): Server
