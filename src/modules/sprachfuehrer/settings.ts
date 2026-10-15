import { getMeta, setMeta } from '@/core/meta'
import { ALLERGEN_IDS, type AllergenId } from './phrases'

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

/** Gewählte Allergene für die Allergie-Karte – nur auf diesem Gerät (persönlich, wird nicht abgeglichen) */
export async function loadAllergens(): Promise<AllergenId[]> {
  const list = await getMeta<string[]>(KEY, [])
  return ALLERGEN_IDS.filter((a) => list.includes(a))
}

export async function saveAllergens(list: AllergenId[]): Promise<void> {
  await setMeta(KEY, [...list])
}

export async function loadCustomAllergens(): Promise<CustomAllergen[]> {
  const list = await getMeta<CustomAllergen[]>(OWN, [])
  return Array.isArray(list) ? list.filter((x) => x && typeof x.text === 'string' && x.text.trim()).map((x) => ({ id: String(x.id), text: x.text, tr: { ...(x.tr ?? {}) } })) : []
}

export async function saveCustomAllergens(list: CustomAllergen[]): Promise<void> {
  await setMeta(OWN, JSON.parse(JSON.stringify(list)))
}
