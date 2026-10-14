/**
 * Zusätzliche Bereiche der Reise-Webseite: Unterkünfte und Unternehmungen.
 * Bewusst ohne Abhängigkeit zu den Modulen „Unterkünfte“/„Unternehmungen“ – die Webseite bekommt
 * nur einfache Daten (auch der Lese-Link-Betrachter, der vom Server schon gefilterte Daten erhält).
 */
import { diffDays } from '../../core/dates'
import type { SiteActivity, SiteStay } from './types'
import { t } from '@/core/i18n'

export const STAY_TYPE: Record<string, { label: string; emoji: string }> = {
  hotel: { label: t('Hotel'), emoji: '🏨' },
  ferienwohnung: { label: t('Ferienwohnung'), emoji: '🏠' },
  camping: { label: t('Camping'), emoji: '⛺' },
  hostel: { label: t('Hostel'), emoji: '🛏️' },
  privat: { label: t('Bei Freunden'), emoji: '🏡' },
  sonstiges: { label: t('Unterkunft'), emoji: '🛏️' }
}

export const ACTIVITY_KIND: Record<string, { label: string; emoji: string }> = {
  kultur: { label: t('Kultur'), emoji: '🏛️' },
  natur: { label: t('Natur'), emoji: '🌲' },
  aktiv: { label: t('Aktiv'), emoji: '🚴' },
  essen: { label: t('Essen & Trinken'), emoji: '🍽️' },
  entspannung: { label: t('Entspannung'), emoji: '🌊' },
  kinder: { label: t('Für Kinder'), emoji: '🎈' },
  sonstiges: { label: t('Erlebnis'), emoji: '✨' }
}

/** Unterkunft, wie sie in die Webseite geht (Preis, Buchungsnummer, Notizen kommen nie mit). */
export interface StayInput {
  name: string
  type: string
  checkIn: string
  checkOut: string
  address?: string
  url?: string
  status?: string
}

export interface ActivityInput {
  title: string
  category: string
  date: string
  place?: string
  status?: string
}

/**
 * Welche Unterkünfte gezeigt werden: nie stornierte. Ist mindestens eine als „gebucht“ markiert,
 * nur die gebuchten – sonst wären auch verworfene Ideen auf der Seite.
 */
export function chooseStays<T extends { status?: string }>(stays: T[]): T[] {
  const live = stays.filter((s) => s.status !== 'storniert')
  return live.some((s) => s.status === 'gebucht') ? live.filter((s) => s.status === 'gebucht') : live
}

/** Welche Unternehmungen: erledigte – gibt es noch keine, die geplanten (Ideen und Verworfenes nie). */
export function chooseActivities<T extends { status?: string }>(acts: T[]): T[] {
  const done = acts.filter((a) => a.status === 'erledigt')
  return done.length ? done : acts.filter((a) => a.status === 'geplant')
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const safeUrl = (u = '') => (/^https?:\/\/[^\s"'<>]+$/i.test(u.trim()) ? u.trim() : '')

export function toSiteStays(stays: StayInput[], details: boolean): SiteStay[] {
  return stays
    .filter((s) => s.name?.trim())
    .map((s) => {
      const checkIn = DATE_RE.test(s.checkIn) ? s.checkIn : ''
      const checkOut = DATE_RE.test(s.checkOut) ? s.checkOut : ''
      const t = STAY_TYPE[s.type] ?? STAY_TYPE.sonstiges
      return {
        name: s.name.trim(),
        type: t.label,
        emoji: t.emoji,
        checkIn,
        checkOut,
        nights: checkIn && checkOut ? Math.max(0, diffDays(checkIn, checkOut)) : null,
        address: details ? (s.address ?? '').trim() : '',
        url: details ? safeUrl(s.url) : ''
      }
    })
    .sort((a, b) => (a.checkIn || '9999').localeCompare(b.checkIn || '9999'))
}

export function toSiteActivities(acts: ActivityInput[], withPlace: boolean): SiteActivity[] {
  return acts
    .filter((a) => a.title?.trim())
    .map((a) => {
      const k = ACTIVITY_KIND[a.category] ?? ACTIVITY_KIND.sonstiges
      return {
        title: a.title.trim(),
        kind: k.label,
        emoji: k.emoji,
        date: DATE_RE.test(a.date) ? a.date : '',
        place: withPlace ? (a.place ?? '').trim() : ''
      }
    })
    .sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || a.title.localeCompare(b.title))
}
