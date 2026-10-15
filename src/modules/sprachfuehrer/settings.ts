import { getMeta, setMeta } from '@/core/meta'
import { ALLERGEN_IDS, type AllergenId } from './phrases'

const KEY = 'sprachfuehrer.allergene'

/** Gewählte Allergene für die Allergie-Karte – nur auf diesem Gerät (persönlich, wird nicht abgeglichen) */
export async function loadAllergens(): Promise<AllergenId[]> {
  const list = await getMeta<string[]>(KEY, [])
  return ALLERGEN_IDS.filter((a) => list.includes(a))
}

export async function saveAllergens(list: AllergenId[]): Promise<void> {
  await setMeta(KEY, [...list])
}
