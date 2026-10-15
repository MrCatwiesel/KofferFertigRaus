import { t } from '@/i18n'
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

export const CATEGORY: Record<ActivityCategory, { label: string; icon: string }> = {
  kultur: { label: t('Kultur'), icon: 'bank' },
  natur: { label: t('Natur'), icon: 'tree' },
  aktiv: { label: t('Aktiv'), icon: 'bicycle' },
  essen: { label: t('Essen & Trinken'), icon: 'cup-hot' },
  entspannung: { label: t('Entspannung'), icon: 'water' },
  kinder: { label: t('Für Kinder'), icon: 'balloon' },
  sonstiges: { label: t('Sonstiges'), icon: 'three-dots' }
}

export const SETTING: Record<ActivitySetting, { label: string; icon: string }> = {
  innen: { label: t('Drinnen'), icon: 'house' },
  aussen: { label: t('Draußen'), icon: 'sun' },
  gemischt: { label: t('Drinnen & draußen'), icon: 'cloud-sun' }
}

export const PRIORITY: Record<ActivityPriority, string> = {
  1: t('Muss'),
  2: t('Gern'),
  3: t('Vielleicht')
}

export const ACTIVITY_STATUS: Record<ActivityStatus, { label: string; badge: string }> = {
  idee: { label: t('Idee'), badge: 'text-bg-light border' },
  geplant: { label: t('Geplant'), badge: 'text-bg-primary' },
  erledigt: { label: t('Erledigt'), badge: 'text-bg-success' },
  verworfen: { label: t('Verworfen'), badge: 'text-bg-secondary' }
}
