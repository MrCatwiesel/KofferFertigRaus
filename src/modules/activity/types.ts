import { N_, translated } from '@/core/i18n'
export type ActivityCategory = 'kultur' | 'natur' | 'aktiv' | 'essen' | 'entspannung' | 'kinder' | 'sonstiges'
export type ActivitySetting = 'innen' | 'aussen' | 'gemischt'
export type ActivityStatus = 'idee' | 'geplant' | 'erledigt' | 'verworfen'
/** 1 = Muss, 2 = Gern, 3 = Vielleicht */
export type ActivityPriority = 1 | 2 | 3

/** Eine Unternehmung (Sehenswürdigkeit, Ausflug, Restaurant …) innerhalb einer Reise. */
export interface Activity {
  id: string
  tripId: string
  title: string
  category: ActivityCategory
  /** Ort oder Adresse */
  place: string
  url: string
  /** Innen/Außen – Grundlage für die wetterabhängige Tagesplanung (M3) */
  setting: ActivitySetting
  priority: ActivityPriority
  /** Geschätzte Dauer in Stunden */
  durationHours: number | null
  /** Preis pro Person */
  pricePerPerson: number | null
  currency: string
  /** Öffnungszeiten als Freitext, z. B. "Di–So 10–18 Uhr" (später OSM-Format) */
  openingHours: string
  bookingRequired: boolean
  status: ActivityStatus
  /** Geplanter Tag (ISO-Datum) oder leer */
  plannedDate: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type ActivityDraft = Omit<Activity, 'id' | 'tripId' | 'createdAt' | 'updatedAt'>

export const CATEGORY: Record<ActivityCategory, { label: string; icon: string }> = translated({
  kultur: { label: N_('Kultur'), icon: 'bank' },
  natur: { label: N_('Natur'), icon: 'tree' },
  aktiv: { label: N_('Aktiv'), icon: 'bicycle' },
  essen: { label: N_('Essen & Trinken'), icon: 'cup-hot' },
  entspannung: { label: N_('Entspannung'), icon: 'water' },
  kinder: { label: N_('Für Kinder'), icon: 'balloon' },
  sonstiges: { label: N_('Sonstiges'), icon: 'three-dots' }
})

export const SETTING: Record<ActivitySetting, { label: string; icon: string }> = translated({
  innen: { label: N_('Drinnen'), icon: 'house' },
  aussen: { label: N_('Draußen'), icon: 'sun' },
  gemischt: { label: N_('Drinnen & draußen'), icon: 'cloud-sun' }
})

export const PRIORITY: Record<ActivityPriority, string> = translated({
  1: N_('Muss'),
  2: N_('Gern'),
  3: N_('Vielleicht')
})

export const ACTIVITY_STATUS: Record<ActivityStatus, { label: string; badge: string }> = translated({
  idee: { label: N_('Idee'), badge: 'text-bg-light border' },
  geplant: { label: N_('Geplant'), badge: 'text-bg-primary' },
  erledigt: { label: N_('Erledigt'), badge: 'text-bg-success' },
  verworfen: { label: N_('Verworfen'), badge: 'text-bg-secondary' }
})
