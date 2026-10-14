/** Eine Antwortmöglichkeit – Freitext oder eine Unternehmung der Reise */
export interface PollOption {
  id: string
  text: string
  /** Verweis auf eine Unternehmung (Idee zur Wahl gestellt) */
  activityId?: string
}

/** Abstimmung in einer Reise, z. B. „Wohin am Samstag?“ (wird abgeglichen). */
export interface Poll {
  id: string
  tripId: string
  question: string
  notes: string
  options: PollOption[]
  /** Mehrere Antworten erlaubt */
  multiple: boolean
  /** Beendet – keine Stimmen mehr */
  closed: boolean
  /** Abstimmen bis (YYYY-MM-DD) oder leer */
  deadline: string
  /** Name, wer sie angelegt hat */
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type PollDraft = Pick<Poll, 'question' | 'notes' | 'options' | 'multiple' | 'deadline'>

/**
 * Stimme einer Person – eigener Datensatz je Person und Abstimmung (`${pollId}:${voter}`),
 * damit gleichzeitiges Abstimmen auf mehreren Geräten nichts überschreibt.
 */
export interface PollVote {
  id: string
  tripId: string
  pollId: string
  /** Teilnehmer-Name (oder Name der Person) */
  voter: string
  /** Person beim Abgleich-Server – dann ändert nur sie diese Stimme (auch mit „Nur lesen“) */
  memberId: string | null
  /** Gewählte Antworten (ids) */
  choices: string[]
  createdAt: string
  updatedAt: string
}
