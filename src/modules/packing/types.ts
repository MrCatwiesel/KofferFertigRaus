import { t } from '@/i18n'
export type PackingCategory =
  | 'kleidung'
  | 'hygiene'
  | 'gesundheit'
  | 'dokumente'
  | 'technik'
  | 'freizeit'
  | 'kinder'
  | 'unterwegs'
  | 'sonstiges'

/** Ein Gegenstand auf der Packliste einer Reise. */
export interface PackingItem {
  id: string
  tripId: string
  name: string
  category: PackingCategory
  quantity: number
  /** Für wen, z. B. "Anna"; leer = für alle / gemeinsam */
  person: string
  packed: boolean
  /** Wichtig – darf auf keinen Fall fehlen */
  essential: boolean
  notes: string
  createdAt: string
  updatedAt: string
}

export type PackingDraft = Omit<PackingItem, 'id' | 'tripId' | 'createdAt' | 'updatedAt'>

export const CATEGORY: Record<PackingCategory, { label: string; icon: string; order: number }> = {
  dokumente: { label: t('Dokumente & Geld'), icon: 'passport', order: 1 },
  kleidung: { label: t('Kleidung'), icon: 'bag', order: 2 },
  hygiene: { label: t('Hygiene & Pflege'), icon: 'droplet', order: 3 },
  gesundheit: { label: t('Gesundheit'), icon: 'heart-pulse', order: 4 },
  technik: { label: t('Technik'), icon: 'phone', order: 5 },
  unterwegs: { label: t('Für unterwegs'), icon: 'cup-straw', order: 6 },
  freizeit: { label: t('Freizeit & Sport'), icon: 'sunglasses', order: 7 },
  kinder: { label: t('Kinder'), icon: 'balloon', order: 8 },
  sonstiges: { label: t('Sonstiges'), icon: 'three-dots', order: 9 }
}
