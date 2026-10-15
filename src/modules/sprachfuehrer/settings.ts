import { getMeta, setMeta } from '@/core/meta'
import { ALLERGEN_IDS, type AllergenId } from './phrases'

/**
 * Bis Version 1.42 lagen die Allergien nur auf dem Gerät (meta). Seit 1.43 gehören sie zur Person
 * (Modul „Gesundheit & Notfall“) – die alten Werte werden nur noch gelesen, um sie einmal zu übernehmen.
 */
const KEY = 'sprachfuehrer.allergene'
const OWN = 'sprachfuehrer.eigene-allergene'

/** Eigene Allergie, die die App nicht kennt – mit selbst eingetragenen Übersetzungen je Sprache */
export interface CustomAllergen {
  id: string
  /** wie eingegeben (Sprache der App) */
  text: string
  /** Sprache → Übersetzung */
  tr: Record<string, string>
}

export async function loadAllergens(): Promise<AllergenId[]> {
  const list = await getMeta<string[]>(KEY, [])
  return ALLERGEN_IDS.filter((a) => Array.isArray(list) && list.includes(a))
}

export async function loadCustomAllergens(): Promise<CustomAllergen[]> {
  const list = await getMeta<CustomAllergen[]>(OWN, [])
  return Array.isArray(list) ? list.filter((x) => x && typeof x.text === 'string' && x.text.trim()).map((x) => ({ id: String(x.id), text: x.text, tr: { ...(x.tr ?? {}) } })) : []
}

/** Nach der Übernahme: Gerätewerte löschen */
export async function clearDeviceAllergens(): Promise<void> {
  await setMeta(KEY, [])
  await setMeta(OWN, [])
}
