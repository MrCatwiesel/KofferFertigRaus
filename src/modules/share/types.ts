import type { FontChoice, TemplateId } from '@/modules/website/public'

/** Was ein Lese-Link zeigt: nur die Highlights oder das ganze Tagebuch. */
export type ShareMode = 'highlights' | 'journal'

/** Aussehen der Seite; null = wie die Reise-Webseite eingestellt ist. */
export interface ShareLook {
  template: TemplateId
  accent: string
  font: FontChoice
  dark: boolean
  showMood: boolean
  showLocation: boolean
}

/** Ein Lese-Link, wie ihn der Server liefert. */
export interface ShareLink {
  token: string
  tripId: string
  mode: ShareMode
  photos: boolean
  /** Freigegebene Routen zeigen */
  routes: boolean
  /** Unterkünfte zeigen (Name, Art, Zeitraum) – ältere Links haben das nicht → aus */
  stays?: boolean
  /** Dazu Adresse und Link der Unterkunft */
  stayDetails?: boolean
  /** Unternehmungen zeigen */
  activities?: boolean
  title: string
  /** Nur für dich: für wen der Link ist, z. B. „Familie“ */
  note: string
  look: ShareLook | null
  password: boolean
  expires: string | null
  revoked: boolean
  created: string
  lastAccess: string | null
  accessCount: number
}

export interface ShareDraft {
  mode: ShareMode
  photos: boolean
  routes: boolean
  stays: boolean
  stayDetails: boolean
  activities: boolean
  title: string
  note: string
  password: string
  /** null = unbegrenzt */
  expiresDays: number | null
  look: ShareLook | null
}
