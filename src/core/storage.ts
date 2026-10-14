import { locale } from '@/core/i18n'
/**
 * Speicher des Browsers: Fotos brauchen Platz. Safari (iPad/iPhone) kann Daten von Webseiten
 * löschen, wenn wenig Speicher frei ist oder die Seite lange nicht genutzt wurde – außer der Speicher
 * ist als "dauerhaft" markiert oder die App ist zum Home-Bildschirm hinzugefügt.
 */

export interface StorageInfo {
  usedBytes: number | null
  quotaBytes: number | null
  persisted: boolean | null
}

/** Bittet den Browser, die Daten dauerhaft zu behalten. Liefert true, wenn gewährt. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false
    if (await navigator.storage.persisted?.()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function storageInfo(): Promise<StorageInfo> {
  try {
    const est = await navigator.storage?.estimate?.()
    const persisted = (await navigator.storage?.persisted?.()) ?? null
    return { usedBytes: est?.usage ?? null, quotaBytes: est?.quota ?? null, persisted }
  } catch {
    return { usedBytes: null, quotaBytes: null, persisted: null }
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let v = bytes / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toLocaleString(locale(), { maximumFractionDigits: v < 10 ? 1 : 0 })} ${units[i]}`
}
