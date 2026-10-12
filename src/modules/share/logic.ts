import type { ShareDraft, ShareLink } from './types'

export const MODE_LABEL = { highlights: 'Nur Highlights', journal: 'Ganzes Tagebuch' } as const

export const EXPIRY_OPTIONS: { days: number | null; label: string }[] = [
  { days: null, label: 'Unbegrenzt' },
  { days: 7, label: '1 Woche' },
  { days: 30, label: '1 Monat' },
  { days: 90, label: '3 Monate' },
  { days: 365, label: '1 Jahr' }
]

export function emptyShareDraft(): ShareDraft {
  return { mode: 'highlights', photos: true, title: '', note: '', password: '', expiresDays: null, look: null }
}

/** Adresse des Links: /s/<code> auf dem eigenen Server. */
export function shareUrl(server: string, token: string): string {
  return `${server.replace(/\/+$/, '')}/s/${token}`
}

export type ShareState = 'aktiv' | 'zurückgezogen' | 'abgelaufen'

export function shareState(link: Pick<ShareLink, 'revoked' | 'expires'>, nowIso = new Date().toISOString()): ShareState {
  if (link.revoked) return 'zurückgezogen'
  if (link.expires && link.expires < nowIso) return 'abgelaufen'
  return 'aktiv'
}

/** Kurzbeschreibung, z. B. "Nur Highlights · mit Fotos · Passwort" */
export function describeShare(link: Pick<ShareLink, 'mode' | 'photos' | 'password'>): string {
  return [MODE_LABEL[link.mode], link.photos ? 'mit Fotos' : 'ohne Fotos', link.password ? 'Passwort' : ''].filter(Boolean).join(' · ')
}

/** "Noch nicht geöffnet" oder "3× geöffnet" */
export function accessLabel(link: Pick<ShareLink, 'accessCount'>): string {
  return link.accessCount ? `${link.accessCount}× geöffnet` : 'Noch nicht geöffnet'
}

/** Name des Links für die Liste: Notiz, sonst eigener Titel, sonst Art. */
export function shareName(link: Pick<ShareLink, 'note' | 'title' | 'mode'>): string {
  return link.note || link.title || MODE_LABEL[link.mode]
}
