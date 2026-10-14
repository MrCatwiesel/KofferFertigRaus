import { N_, translated } from '@/core/i18n'
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

export const ACCOMMODATION_TYPE_LABELS: Record<AccommodationType, string> = translated({
  hotel: N_('Hotel'),
  ferienwohnung: N_('Ferienwohnung'),
  camping: N_('Camping'),
  hostel: N_('Hostel'),
  privat: N_('Privat / Freunde'),
  sonstiges: N_('Sonstiges')
})

export const ACCOMMODATION_STATUS: Record<AccommodationStatus, { label: string; badge: string }> = translated({
  idee: { label: N_('Idee'), badge: 'text-bg-light border' },
  angefragt: { label: N_('Angefragt'), badge: 'text-bg-warning' },
  gebucht: { label: N_('Gebucht'), badge: 'text-bg-success' },
  storniert: { label: N_('Storniert'), badge: 'text-bg-secondary' }
})
