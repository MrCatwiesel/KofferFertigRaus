import { t } from '@/i18n'
export type PlaceKind = 'accommodation' | 'activity'

/** Position eines Ortes auf der Karte (Unterkunft oder Unternehmung). */
export interface MapPlace {
  /** `${kind}:${refId}` */
  id: string
  tripId: string
  kind: PlaceKind
  refId: string
  lat: number
  lon: number
  /** Gefundene Adresse bzw. "auf der Karte gesetzt" */
  label: string
  updatedAt: string
}

export const KIND_STYLE: Record<PlaceKind, { label: string; color: string; icon: string }> = {
  accommodation: { label: t('Unterkunft'), color: '#6366f1', icon: 'house-door-fill' },
  activity: { label: t('Unternehmung'), color: '#10b981', icon: 'star-fill' }
}
