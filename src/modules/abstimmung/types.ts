import { t } from '@/i18n'
/** Abstimmungen: gemeinsam entscheiden – Ausflug, Tag, Restaurant … */

/** auswahl: freie Antworten · termin: Tage (optional für eine Unternehmung) · unternehmung: Ideen aus den Unternehmungen */
export type PollKind = 'auswahl' | 'termin' | 'unternehmung'

export interface PollOption {
  id: string
  /** Antwort; bei Terminen zusätzlicher Text, z. B. „vormittags“ */
  text: string
  /** Termin: Tag (YYYY-MM-DD) */
  date?: string
  /** Unternehmung, für die diese Antwort steht */
  activityId?: string
}

export interface Poll {
  id: string
  tripId: string
  question: string
  kind: PollKind
  options: PollOption[]
  /** Mehrere Antworten erlaubt (bei Terminen üblich: „an welchen Tagen könnt ihr?“) */
  multiple: boolean
  /** Letzter Tag zum Abstimmen (YYYY-MM-DD) oder leer */
  deadline: string
  /** Von Hand beendet */
  closed: boolean
  /** Termin-Abstimmung für eine Unternehmung: der gewählte Tag wird dort eingetragen */
  activityId?: string
  /** Teilnehmer-Name, der die Abstimmung angelegt hat */
  createdBy: string
  note: string
  createdAt: string
  updatedAt: string
}

export type PollDraft = Omit<Poll, 'id' | 'tripId' | 'createdAt' | 'updatedAt'>

/**
 * Eine Stimme – je Teilnehmer und Abstimmung ein eigener Datensatz (`<pollId>:<Name>`).
 * So überschreiben sich Stimmen von zwei Geräten beim Abgleich nicht gegenseitig.
 */
export interface PollVote {
  id: string
  pollId: string
  tripId: string
  /** Teilnehmer-Name */
  voter: string
  /** Gewählte Antworten (ids); leer = enthalten */
  choices: string[]
  createdAt: string
  updatedAt: string
}

export const KIND_LABELS: Record<PollKind, { label: string; icon: string; hint: string }> = {
  auswahl: { label: t('Freie Antworten'), icon: 'ui-checks', hint: t('z. B. Restaurant, Ausflugsziel, Abfahrtszeit') },
  termin: { label: t('Tag finden'), icon: 'calendar-week', hint: t('Welche Tage passen? Wahlweise für eine Unternehmung') },
  unternehmung: { label: t('Unternehmung wählen'), icon: 'star', hint: t('Aus den Ideen der Reise') }
}
