import { t } from '@/i18n'
export type AccommodationType = 'hotel' | 'ferienwohnung' | 'camping' | 'hostel' | 'privat' | 'sonstiges'
export type AccommodationStatus = 'idee' | 'angefragt' | 'gebucht' | 'storniert'

/** Eine Unterkunft innerhalb einer Reise. */
export interface Accommodation {
  id: string
  tripId: string
  name: string
  type: AccommodationType
  address: string
  /** Link zur Unterkunft oder Buchung */
  url: string
  /** ISO-Datum YYYY-MM-DD, Anreisetag */
  checkIn: string
  /** ISO-Datum YYYY-MM-DD, Abreisetag */
  checkOut: string
  /** Gesamtpreis für den Aufenthalt */
  price: number | null
  currency: string
  status: AccommodationStatus
  bookingRef: string
  /** Kostenlos stornierbar bis (ISO-Datum) oder leer */
  cancelUntil: string
  notes: string
  createdAt: string
  updatedAt: string
}

export type AccommodationDraft = Omit<Accommodation, 'id' | 'tripId' | 'createdAt' | 'updatedAt'>

export const ACCOMMODATION_TYPE_LABELS: Record<AccommodationType, string> = {
  hotel: t('Hotel'),
  ferienwohnung: t('Ferienwohnung'),
  camping: t('Camping'),
  hostel: t('Hostel'),
  privat: t('Privat / Freunde'),
  sonstiges: t('Sonstiges')
}

export const ACCOMMODATION_STATUS: Record<AccommodationStatus, { label: string; badge: string }> = {
  idee: { label: t('Idee'), badge: 'text-bg-light border' },
  angefragt: { label: t('Angefragt'), badge: 'text-bg-warning' },
  gebucht: { label: t('Gebucht'), badge: 'text-bg-success' },
  storniert: { label: t('Storniert'), badge: 'text-bg-secondary' }
}
