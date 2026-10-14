/**
 * Reine Abgleich-Logik ohne Datenbank und ohne Netzwerk – einfach testbar.
 */
import { stampOf } from '../merge'
import { t } from '@/core/i18n'

export interface RemoteChange {
  seq?: number
  tbl: string
  id: string
  stamp: string
  deleted: boolean
  data: Record<string, unknown> | null
}

/** Verweis auf ein Foto auf dem Server statt der Bilddaten. */
export interface BlobRef {
  __blobRef: string
  type: string
}

export function isBlobRef(v: unknown): v is BlobRef {
  return !!v && typeof v === 'object' && typeof (v as BlobRef).__blobRef === 'string'
}

/** Was mit einer Änderung vom Server lokal passieren soll. */
export type ApplyAction = 'put' | 'delete' | 'skip'

/**
 * Neuere gewinnt:
 *  - Löschung: nur, wenn die lokale Fassung nicht neuer ist
 *  - Daten: nur, wenn neu oder neuer als lokal
 */
export function applyAction(local: Record<string, unknown> | undefined, change: RemoteChange): ApplyAction {
  if (change.deleted) {
    if (!local) return 'skip'
    return stampOf(local) > change.stamp ? 'skip' : 'delete'
  }
  if (!change.data) return 'skip'
  if (!local) return 'put'
  return change.stamp > stampOf(local) ? 'put' : 'skip'
}

/** Zeitstempel, mit dem eine lokale Fassung hochgeladen wird. Fehlt er, gilt "jetzt". */
export function uploadStamp(row: Record<string, unknown>, now: string): string {
  return stampOf(row) || now
}

/** Zufälliger Schlüssel für eine Reisegruppe (32 Zeichen, gut lesbar, ohne verwechselbare Zeichen). */
export function generateKey(random: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = random(32)
  let out = ''
  for (const b of bytes) out += alphabet[b % alphabet.length]
  return out.replace(/(.{8})(?=.)/g, '$1-')
}

/** Server-Adresse vereinheitlichen: https ergänzen, Schrägstrich am Ende entfernen. */
export function normalizeServerUrl(input: string): string {
  let s = input.trim()
  if (!s) return ''
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`
  return s.replace(/\/+$/, '')
}

/** Prüft, ob die App (https) den Server erreichen darf – Browser blockieren http von https-Seiten. */
export function mixedContentProblem(serverUrl: string, pageProtocol: string): boolean {
  return pageProtocol === 'https:' && /^http:\/\//i.test(serverUrl) && !/^http:\/\/(localhost|127\.0\.0\.1)(:|\/|$)/i.test(serverUrl)
}

/** Kopplungs-Link für weitere Geräte. */
export function pairingLink(appUrl: string, server: string, key: string): string {
  const base = appUrl.split('#')[0]
  return `${base}#/abgleich?${new URLSearchParams({ server, key })}`
}

/** Einladungscode des Servers: 12 Zeichen (ohne 0/O/1/I), gern als ABCD-EFGH-JKLM geschrieben. */
export function normalizeInviteCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '')
}
export function isInviteCode(input: string): boolean {
  return /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{12}$/.test(normalizeInviteCode(input))
}

/** Link zum Verbinden eines weiteren Geräts – enthält nur die einmalige Einladung, nie den Schlüssel. */
export function inviteLink(appUrl: string, server: string, code: string): string {
  const base = appUrl.split('#')[0]
  return `${base}#/abgleich?${new URLSearchParams({ server, code })}`
}

/** Vorschlag für den Gerätenamen, z. B. „iPad“ oder „Android-Handy“. */
export function defaultDeviceName(ua: string, touchPoints = 0): string {
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1)) return 'iPad'
  if (/iPhone/.test(ua)) return 'iPhone'
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? t('Android-Handy') : t('Android-Tablet')
  if (/Macintosh|Mac OS X/.test(ua)) return 'Mac'
  if (/Windows/.test(ua)) return 'Windows-PC'
  if (/Linux/.test(ua)) return 'Linux-PC'
  return t('Gerät')
}

/** Teilt eine Liste in Stücke (für Uploads in Portionen). */
export function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size))
  return out
}

/** "vor 5 Min." usw. */
export function ago(iso: string | null, now: Date = new Date()): string {
  if (!iso) return t('noch nie')
  const s = Math.round((now.getTime() - Date.parse(iso)) / 1000)
  if (s < 60) return t('gerade eben')
  if (s < 3600) return t('vor {0} Min.', [Math.round(s / 60)])
  if (s < 86400) return t('vor {0} Std.', [Math.round(s / 3600)])
  return t('vor {0} Tagen', [Math.round(s / 86400)])
}
