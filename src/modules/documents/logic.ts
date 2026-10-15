import { diffDays, todayIso } from '../../core/dates'
import type { DocType, EmergencyContactDraft, TravelDocument, TravelDocumentDraft } from './types'
import { t } from '@/i18n'

/** Monate, die ein Reisepass über das Reiseende hinaus gültig sein sollte (häufige Einreiseregel). */
export const PASSPORT_BUFFER_MONTHS = 6

export function emptyDocumentDraft(over: Partial<TravelDocumentDraft> = {}): TravelDocumentDraft {
  return {
    type: 'sonstiges',
    title: '',
    person: '',
    number: '',
    validUntil: '',
    status: 'vorhanden',
    hasCopy: false,
    packed: false,
    notes: '',
    ...over
  }
}

export function emptyContactDraft(over: Partial<EmergencyContactDraft> = {}): EmergencyContactDraft {
  return { label: '', phone: '', notes: '', ...over }
}

/** Datum + n Monate (Tag bleibt, ggf. auf Monatsende gekürzt). */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  const target = new Date(Date.UTC(y, m - 1 + months, 1))
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate()
  target.setUTCDate(Math.min(d, lastDay))
  return target.toISOString().slice(0, 10)
}

export type ValidityState = 'ok' | 'abgelaufen' | 'reise' | 'knapp' | 'unbekannt'

/**
 * Gültigkeit im Verhältnis zur Reise:
 *  - abgelaufen: schon jetzt ungültig
 *  - reise: endet vor oder während der Reise
 *  - knapp: Reisepass weniger als 6 Monate über das Reiseende gültig
 */
export function validity(doc: Pick<TravelDocument, 'type' | 'validUntil'>, tripEnd: string, today: Date = new Date()): ValidityState {
  if (!doc.validUntil) return 'unbekannt'
  if (doc.validUntil < todayIso(today)) return 'abgelaufen'
  if (doc.validUntil <= tripEnd) return 'reise'
  if (doc.type === 'reisepass' && doc.validUntil < addMonths(tripEnd, PASSPORT_BUFFER_MONTHS)) return 'knapp'
  return 'ok'
}

export const VALIDITY_TEXT: Record<Exclude<ValidityState, 'ok' | 'unbekannt'>, { text: string; cls: string }> = {
  abgelaufen: { text: t('abgelaufen'), cls: 'text-danger' },
  reise: { text: t('endet vor Reiseende'), cls: 'text-danger' },
  knapp: { text: t('weniger als 6 Monate über Reiseende gültig – Einreiseregeln prüfen'), cls: 'text-warning-emphasis' }
}

/** Ausweise, die erneuert werden müssen und deren Bearbeitung mehrere Wochen dauern kann. */
export function needsRenewalSoon(
  doc: Pick<TravelDocument, 'type' | 'validUntil' | 'status'>,
  tripStart: string,
  tripEnd: string,
  today: Date = new Date()
): boolean {
  if (!['ausweis', 'reisepass', 'visum'].includes(doc.type)) return false
  const v = validity(doc, tripEnd, today)
  const problem = doc.status === 'fehlt' || v === 'abgelaufen' || v === 'reise' || v === 'knapp'
  return problem && diffDays(todayIso(today), tripStart) <= 56
}

export interface DocSummary {
  total: number
  missing: number
  problems: number
  notPacked: number
}

export function summarizeDocs(list: TravelDocument[], tripEnd: string, today: Date = new Date()): DocSummary {
  return {
    total: list.length,
    missing: list.filter((d) => d.status !== 'vorhanden').length,
    problems: list.filter((d) => ['abgelaufen', 'reise', 'knapp'].includes(validity(d, tripEnd, today))).length,
    notPacked: list.filter((d) => d.status === 'vorhanden' && !d.packed).length
  }
}

const TYPE_ORDER: DocType[] = ['reisepass', 'ausweis', 'visum', 'fuehrerschein', 'fahrzeug', 'versicherung', 'gesundheit', 'ticket', 'buchung', 'sonstiges']

/** Probleme zuerst, dann nach Dokumentart, dann Person. */
export function sortDocs(list: TravelDocument[], tripEnd: string, today: Date = new Date()): TravelDocument[] {
  const rank = (d: TravelDocument) => {
    const v = validity(d, tripEnd, today)
    if (d.status === 'fehlt' || v === 'abgelaufen' || v === 'reise') return 0
    if (d.status === 'beantragt' || v === 'knapp') return 1
    return 2
  }
  return [...list].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) ||
      a.person.localeCompare(b.person, 'de') ||
      a.title.localeCompare(b.title, 'de')
  )
}

/**
 * Vorschläge passend zur Reise.
 * Mit Teilnehmern bekommt jede Person eigene persönliche Dokumente (Ausweis, Versicherungskarte, Impfpass).
 * Bereits vorhandene (gleicher Titel für dieselbe Person) werden übersprungen.
 * `transport` ist die Anreiseart der Reise (auto, bahn, flug, bus, sonstiges).
 */
export function suggestDocuments(
  transport: string,
  existing: Pick<TravelDocument, 'title' | 'person'>[] = [],
  participants: string[] = []
): TravelDocumentDraft[] {
  const personal: TravelDocumentDraft[] = [
    emptyDocumentDraft({ type: 'ausweis', title: t('Personalausweis oder Reisepass') }),
    emptyDocumentDraft({ type: 'versicherung', title: t('Krankenversicherungskarte') }),
    emptyDocumentDraft({ type: 'gesundheit', title: t('Impfpass') })
  ]
  const shared: TravelDocumentDraft[] = [
    emptyDocumentDraft({ type: 'versicherung', title: t('Auslandsreisekrankenversicherung') }),
    emptyDocumentDraft({ type: 'buchung', title: t('Buchungsbestätigung Unterkunft') })
  ]
  if (transport === 'auto') {
    shared.push(emptyDocumentDraft({ type: 'fuehrerschein', title: t('Führerschein') }))
    shared.push(emptyDocumentDraft({ type: 'fahrzeug', title: t('Fahrzeugschein & grüne Versicherungskarte') }))
  }
  if (transport === 'flug') shared.push(emptyDocumentDraft({ type: 'ticket', title: t('Flugtickets / Bordkarten') }))
  if (transport === 'bahn') shared.push(emptyDocumentDraft({ type: 'ticket', title: t('Bahntickets') }))
  if (transport === 'bus') shared.push(emptyDocumentDraft({ type: 'ticket', title: t('Bustickets') }))

  const all = participants.length
    ? [...participants.flatMap((p) => personal.map((d) => ({ ...d, person: p }))), ...shared]
    : [...personal, ...shared]

  const key = (title: string, person: string) => `${title.trim().toLowerCase()}|${person.trim().toLowerCase()}`
  const have = new Set(existing.map((e) => key(e.title, e.person ?? '')))
  return all.filter((d) => !have.has(key(d.title, d.person)) && !have.has(key(d.title, '')))
}

/** Telefonnummer für einen tel:-Link: nur Ziffern und führendes +. */
export function telHref(phone: string): string | null {
  // "(0)" in internationalen Nummern wird beim Wählen weggelassen
  const cleaned = phone.trim().replace(/\(0\)/g, '').replace(/(?!^\+)[^\d]/g, '')
  return /^\+?\d{3,}$/.test(cleaned) ? `tel:${cleaned}` : null
}

/** Nummer teilweise verbergen, z. B. "L01X••••7" – für die Übersicht. */
export function maskNumber(n: string): string {
  const s = n.trim()
  if (s.length <= 4) return s ? '••••' : ''
  return `${s.slice(0, 3)}${'•'.repeat(Math.min(6, s.length - 4))}${s.slice(-1)}`
}

export function validateDocument(d: TravelDocumentDraft): Partial<Record<keyof TravelDocumentDraft, string>> {
  const e: Partial<Record<keyof TravelDocumentDraft, string>> = {}
  if (!d.title.trim()) e.title = t('Bitte eine Bezeichnung angeben.')
  return e
}

export function validateContact(d: EmergencyContactDraft): Partial<Record<keyof EmergencyContactDraft, string>> {
  const e: Partial<Record<keyof EmergencyContactDraft, string>> = {}
  if (!d.label.trim()) e.label = t('Bitte angeben, wer das ist.')
  if (!telHref(d.phone)) e.phone = t('Bitte eine gültige Telefonnummer angeben.')
  return e
}
