import { N_, translated } from '@/core/i18n'
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

export const CATEGORY: Record<PackingCategory, { label: string; icon: string; order: number }> = translated({
  dokumente: { label: N_('Dokumente & Geld'), icon: 'passport', order: 1 },
  kleidung: { label: N_('Kleidung'), icon: 'bag', order: 2 },
  hygiene: { label: N_('Hygiene & Pflege'), icon: 'droplet', order: 3 },
  gesundheit: { label: N_('Gesundheit'), icon: 'heart-pulse', order: 4 },
  technik: { label: N_('Technik'), icon: 'phone', order: 5 },
  unterwegs: { label: N_('Für unterwegs'), icon: 'cup-straw', order: 6 },
  freizeit: { label: N_('Freizeit & Sport'), icon: 'sunglasses', order: 7 },
  kinder: { label: N_('Kinder'), icon: 'balloon', order: 8 },
  sonstiges: { label: N_('Sonstiges'), icon: 'three-dots', order: 9 }
})
