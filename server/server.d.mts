import type { Server } from 'node:http'
export const VERSION: string
export function spaceOf(key: string): string
export function createSyncServer(opts: {
  keys: string[]
  dataDir: string
  origins?: string[]
  maxBlobMb?: number
  piwigo?: { url: string; keyId: string; secret: string; publicUrl?: string; fetchImpl?: typeof fetch } | null
  appDir?: string | null
  deviceIdleDays?: number
  routing?: { overpassUrl?: string; brouterUrl?: string; fetchImpl?: typeof fetch }
  reiseinfo?: { url?: string; fetchImpl?: typeof fetch }
  push?: { fetchImpl?: typeof fetch; subject?: string; hosts?: (RegExp | string)[]; timer?: boolean }
  unwetter?: { url?: string; fetchImpl?: typeof fetch }
  maps?: { bin?: string; source?: string; fetchImpl?: typeof fetch }
}): Server
