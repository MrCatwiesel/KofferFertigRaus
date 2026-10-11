export const PIWIGO_SIZES: string[]
export class PiwigoError extends Error {
  status: number
}
export function createPiwigoClient(opts: { url: string; keyId: string; secret: string; publicUrl?: string; fetchImpl?: typeof fetch }): unknown
