export type ExpenseCategory = 'unterkunft' | 'anreise' | 'essen' | 'aktivitaet' | 'einkauf' | 'transport' | 'sonstiges'

/** Eine Ausgabe unterwegs. */
export interface Expense {
  id: string
  tripId: string
  /** ISO-Datum */
  date: string
  amount: number
  currency: string
  /** Kurs: 1 Einheit `currency` = so viel in der Reisewährung (1 bei gleicher Währung) */
  rate: number
  category: ExpenseCategory
  description: string
  /** Wer bezahlt hat (Teilnehmername) oder leer */
  paidBy: string
  /** Auf wen die Ausgabe verteilt wird; leer = alle Teilnehmer */
  splitAmong: string[]
  /** Foto vom Beleg (verkleinert) */
  receipt: Blob | null
  createdAt: string
  updatedAt: string
}

export type ExpenseDraft = Omit<Expense, 'id' | 'tripId' | 'createdAt' | 'updatedAt'>

export const EXPENSE_CATEGORY: Record<ExpenseCategory, { label: string; icon: string; color: string }> = {
  essen: { label: 'Essen & Trinken', icon: 'cup-hot', color: '#f59e0b' },
  unterkunft: { label: 'Unterkunft', icon: 'house-door', color: '#6366f1' },
  aktivitaet: { label: 'Aktivitäten', icon: 'star', color: '#10b981' },
  transport: { label: 'Unterwegs (Taxi, Bus, Parken)', icon: 'bus-front', color: '#0ea5e9' },
  anreise: { label: 'Anreise', icon: 'signpost-split', color: '#64748b' },
  einkauf: { label: 'Einkauf & Souvenirs', icon: 'bag', color: '#ec4899' },
  sonstiges: { label: 'Sonstiges', icon: 'three-dots', color: '#94a3b8' }
}

export const CURRENCIES = ['EUR', 'CHF', 'USD', 'GBP', 'DKK', 'SEK', 'NOK', 'ISK', 'PLN', 'CZK', 'HUF', 'RON', 'TRY', 'THB', 'JPY', 'AUD', 'CAD', 'MAD', 'EGP', 'AED']
