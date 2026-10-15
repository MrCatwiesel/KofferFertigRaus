import type { PiwigoAlbum, PiwigoUpload } from './types'
import { t, tn } from '@/i18n'

const REF_PREFIX = 'piwigo:'

/** Verweis auf ein Piwigo-Foto im Feld `externalRef` eines Tagebuch-Fotos. */
export function externalRef(imageId: number): string {
  return `${REF_PREFIX}${imageId}`
}

/** Piwigo-Bild-ID aus einem Verweis – oder null, wenn er nicht zu Piwigo gehört. */
export function parseExternalRef(ref: string | undefined): number | null {
  if (!ref?.startsWith(REF_PREFIX)) return null
  const n = Number(ref.slice(REF_PREFIX.length))
  return Number.isInteger(n) && n > 0 ? n : null
}

/** Vorschlag für den Albumnamen einer Reise: Titel, ergänzt um das Jahr, wenn es fehlt. */
export function albumNameFor(trip: { title: string; destination?: string; startDate?: string }): string {
  const title = (trip.title || trip.destination || t('Reise')).trim()
  const year = /^\d{4}/.exec(trip.startDate ?? '')?.[0]
  return year && !title.includes(year) ? `${title} ${year}` : title
}

/** Letzter Teil eines vollen Albumnamens ("Urlaube / Gardasee 2025" → "Gardasee 2025"). */
export function lastSegment(fullName: string): string {
  const parts = fullName.split(' / ')
  return (parts.at(-1) ?? fullName).trim()
}

/** Vorhandenes Album mit diesem Namen (unter dem gewünschten übergeordneten Album) – verhindert Doppel. */
export function findAlbumByName(albums: PiwigoAlbum[], name: string, parentId: number | null = null): PiwigoAlbum | undefined {
  const wanted = name.trim().toLocaleLowerCase('de')
  return albums.find((a) => lastSegment(a.name).toLocaleLowerCase('de') === wanted && (a.parentId ?? null) === (parentId ?? null))
}

/** Alben alphabetisch nach vollem Namen (so stehen Unteralben unter ihrem Hauptalbum). */
export function sortAlbums(albums: PiwigoAlbum[]): PiwigoAlbum[] {
  return [...albums].sort((a, b) => a.name.localeCompare(b.name, 'de'))
}

/** Piwigo-Datum "2025-08-01 10:00:00" → "2025-08-01T10:00:00" (leer bleibt leer). */
export function piwigoDate(value: string | null | undefined): string {
  if (!value) return ''
  const m = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?/.exec(value)
  if (!m) return ''
  return m[2] ? `${m[1]}T${m[2].length === 5 ? `${m[2]}:00` : m[2]}` : `${m[1]}T12:00:00`
}

/** Titel des Fotos in Piwigo: Bildunterschrift, sonst Dateiname ohne Endung. */
export function uploadTitle(caption: string, filename: string): string {
  const c = caption.trim()
  if (c) return c
  return filename.replace(/\.[^.]+$/, '').trim()
}

/** Wartezeit bis zum nächsten Versuch: 1, 2, 4 … Minuten, höchstens 6 Stunden. */
export function retryDelayMs(tries: number): number {
  const minutes = Math.min(2 ** Math.max(0, tries - 1), 360)
  return minutes * 60_000
}

/** Ist dieser Eintrag jetzt dran? */
export function isDue(u: Pick<PiwigoUpload, 'nextTryAt'>, nowIso: string): boolean {
  return !u.nextTryAt || u.nextTryAt <= nowIso
}

/** Kurzbeschreibung der Warteschlange, z. B. "3 Fotos warten · 1 Fehler". */
export function describeQueue(uploads: Pick<PiwigoUpload, 'status'>[]): string {
  if (!uploads.length) return ''
  const errors = uploads.filter((u) => u.status === 'error').length
  const waiting = uploads.length
  const parts = [tn(waiting, '1 Foto wartet', '{n} Fotos warten')]
  if (errors) parts.push(t('{n} mit Fehler', { n: errors }))
  return parts.join(' · ')
}
