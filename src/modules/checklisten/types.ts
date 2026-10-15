/** Welche Liste: zu Hause vor der Abfahrt, Auschecken aus einer Unterkunft, Online-Check-in eines Flugs */
export type ChecklistKind = 'zuhause' | 'auschecken' | 'checkin'

/** Ein Punkt einer Abreise-Checkliste (wird abgeglichen). */
export interface ChecklistItem {
  id: string
  tripId: string
  list: ChecklistKind
  /** Unterkunft (auschecken) bzw. Etappe (checkin); leer bei „zuhause“ */
  ref: string
  text: string
  done: boolean
  position: number
  createdAt: string
  updatedAt: string
}
