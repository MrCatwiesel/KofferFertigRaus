import { db } from './db'

/**
 * Interne Einstellungen dieses Geräts (Tabelle `meta`, wird nicht abgeglichen).
 * Einheitlicher Zugriff statt verstreuter db.meta-Aufrufe.
 */
export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  return ((await db.meta.get(key))?.value as T | undefined) ?? fallback
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}

export async function deleteMeta(...keys: string[]): Promise<void> {
  await db.meta.bulkDelete(keys)
}
