import { diffDays, todayIso } from '../../core/dates'
import type { Medication, MedicationDraft, Vaccination, VaccinationDraft } from './types'
import { t } from '@/i18n'

/** Standard-Reserve in Tagen für Verspätungen oder Verlust. */
export const DEFAULT_RESERVE_DAYS = 3

export function emptyMedicationDraft(over: Partial<MedicationDraft> = {}): MedicationDraft {
  return {
    name: '',
    kind: 'dauer',
    person: '',
    dose: '',
    unitsPerDose: 1,
    times: ['08:00'],
    stockUnits: null,
    expiryDate: '',
    prescription: false,
    handLuggage: true,
    cooling: false,
    packed: false,
    notes: '',
    ...over
  }
}

export function emptyVaccinationDraft(over: Partial<VaccinationDraft> = {}): VaccinationDraft {
  return { name: '', person: '', date: '', validUntil: '', status: 'pruefen', notes: '', ...over }
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** Gültige, sortierte, eindeutige Einnahmezeiten. */
export function normalizeTimes(times: string[]): string[] {
  return [...new Set(times.filter((t) => TIME_RE.test(t)))].sort()
}

/**
 * Benötigte Einheiten für die Reise: Einheiten pro Einnahme × Einnahmen pro Tag × (Reisetage + Reserve).
 * Nur für Dauermedikation mit Angaben; sonst null.
 */
export function unitsNeeded(
  m: Pick<Medication, 'kind' | 'unitsPerDose' | 'times'>,
  tripDays: number,
  reserveDays = DEFAULT_RESERVE_DAYS
): number | null {
  const perDay = normalizeTimes(m.times).length
  if (m.kind !== 'dauer' || !m.unitsPerDose || perDay === 0) return null
  return Math.ceil(m.unitsPerDose * perDay * (tripDays + reserveDays))
}

export type StockStatus = { state: 'ok' | 'knapp' | 'unbekannt'; missing: number }

export function stockStatus(m: Pick<Medication, 'kind' | 'unitsPerDose' | 'times' | 'stockUnits'>, tripDays: number, reserveDays = DEFAULT_RESERVE_DAYS): StockStatus {
  const need = unitsNeeded(m, tripDays, reserveDays)
  if (need === null || m.stockUnits === null) return { state: 'unbekannt', missing: 0 }
  const missing = Math.max(0, need - m.stockUnits)
  return { state: missing > 0 ? 'knapp' : 'ok', missing }
}

export type ExpiryState = 'ok' | 'abgelaufen' | 'waehrend' | 'unbekannt'

/** Ablaufdatum im Verhältnis zu heute und zum Reiseende. */
export function expiryStatus(expiryDate: string, tripEnd: string, today: Date = new Date()): ExpiryState {
  if (!expiryDate) return 'unbekannt'
  if (expiryDate < todayIso(today)) return 'abgelaufen'
  if (expiryDate <= tripEnd) return 'waehrend'
  return 'ok'
}

/** Impfschutz läuft vor oder während der Reise ab. */
export function vaccinationNeedsAction(v: Pick<Vaccination, 'status' | 'validUntil'>, tripEnd: string): boolean {
  if (v.status !== 'erledigt') return true
  return !!v.validUntil && v.validUntil <= tripEnd
}

export interface ScheduleEntry {
  time: string
  medication: Medication
}

/** Tages-Einnahmeplan: alle Dauermedikamente nach Uhrzeit (optional für eine Person, Gemeinsames inklusive). */
export function dailySchedule(list: Medication[], person = ''): ScheduleEntry[] {
  const out: ScheduleEntry[] = []
  for (const m of list) {
    if (m.kind !== 'dauer') continue
    if (person && m.person && m.person !== person) continue
    for (const t of normalizeTimes(m.times)) out.push({ time: t, medication: m })
  }
  return out.sort((a, b) => a.time.localeCompare(b.time) || a.medication.name.localeCompare(b.medication.name, 'de'))
}

export interface MedsSummary {
  count: number
  short: number
  expiring: number
  vaccinationsOpen: number
  unpacked: number
}

export function summarizeMeds(meds: Medication[], vaccs: Vaccination[], tripStart: string, tripEnd: string, today: Date = new Date()): MedsSummary {
  const days = diffDays(tripStart, tripEnd) + 1
  return {
    count: meds.length,
    short: meds.filter((m) => stockStatus(m, days).state === 'knapp').length,
    expiring: meds.filter((m) => ['abgelaufen', 'waehrend'].includes(expiryStatus(m.expiryDate, tripEnd, today))).length,
    vaccinationsOpen: vaccs.filter((v) => vaccinationNeedsAction(v, tripEnd)).length,
    unpacked: meds.filter((m) => !m.packed).length
  }
}

/** Sortierung: Notfall, Dauer, Bedarf; dann Name. */
export function sortMeds(list: Medication[]): Medication[] {
  const order = { notfall: 0, dauer: 1, bedarf: 2 } as const
  return [...list].sort((a, b) => order[a.kind] - order[b.kind] || a.name.localeCompare(b.name, 'de'))
}

export function validateMedication(d: MedicationDraft): Partial<Record<keyof MedicationDraft, string>> {
  const e: Partial<Record<keyof MedicationDraft, string>> = {}
  if (!d.name.trim()) e.name = t('Bitte einen Namen angeben.')
  if (d.unitsPerDose !== null && d.unitsPerDose <= 0) e.unitsPerDose = t('Muss größer als 0 sein.')
  if (d.stockUnits !== null && d.stockUnits < 0) e.stockUnits = t('Darf nicht negativ sein.')
  if (d.kind === 'dauer' && normalizeTimes(d.times).length === 0) e.times = t('Mindestens eine Einnahmezeit.')
  if (d.times.some((t) => t && !TIME_RE.test(t))) e.times = t('Zeit im Format HH:MM.')
  return e
}

export function validateVaccination(d: VaccinationDraft): Partial<Record<keyof VaccinationDraft, string>> {
  const e: Partial<Record<keyof VaccinationDraft, string>> = {}
  if (!d.name.trim()) e.name = t('Bitte angeben, welche Impfung.')
  return e
}

/** Impfung, die in den Reisehinweisen der Zielländer genannt wird */
export interface VaccineAdvice {
  name: string
  /** In mindestens einem Land Pflicht (z. B. Gelbfieber-Nachweis) */
  required: boolean
  /** Länder (Namen), in deren Hinweisen sie vorkommt */
  countries: string[]
}

/** Genannte Impfungen mehrerer Länder zusammenfassen (Pflicht zuerst) */
export function mergeVaccineAdvice(list: { countryName: string; vaccines: { name: string; required: boolean }[] }[]): VaccineAdvice[] {
  const map = new Map<string, VaccineAdvice>()
  for (const c of list)
    for (const v of c.vaccines) {
      const a = map.get(v.name) ?? { name: v.name, required: false, countries: [] }
      a.required ||= v.required
      if (!a.countries.includes(c.countryName)) a.countries.push(c.countryName)
      map.set(v.name, a)
    }
  return [...map.values()].sort((a, b) => Number(b.required) - Number(a.required))
}

const vaccKey = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)|impfung|-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Eingetragene Impfung zu einer Empfehlung finden („FSME“ ↔ „FSME-Impfung“, „Keuchhusten (Pertussis)“ ↔ „Keuchhusten“) */
export function matchVaccination<T extends Pick<Vaccination, 'name'>>(advice: Pick<VaccineAdvice, 'name'>, list: T[]): T | undefined {
  const a = vaccKey(advice.name)
  const words = (s: string) => new RegExp(`(^|[^a-zäöü])${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|[^a-zäöü])`)
  return list.find((v) => {
    const k = vaccKey(v.name)
    return !!k && (k === a || words(a).test(k) || words(k).test(a))
  })
}

/** Neue Impfung aus einer Empfehlung (Status „Prüfen“) */
export function vaccinationFromAdvice(a: VaccineAdvice): VaccinationDraft {
  const where = a.countries.join(', ')
  return emptyVaccinationDraft({
    name: a.name,
    notes: a.required
      ? t('Pflicht bei Einreise ({countries}) – laut Auswärtigem Amt.', { countries: where })
      : t('Vom Auswärtigen Amt genannt für {countries} – mit Hausarzt/Reisemedizin klären.', { countries: where })
  })
}
