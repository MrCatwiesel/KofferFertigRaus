import { diffDays, todayIso } from '../../core/dates'
import type { Expense, ExpenseCategory, ExpenseDraft } from './types'
import { t } from '@/i18n'

export function emptyExpenseDraft(over: Partial<ExpenseDraft> = {}): ExpenseDraft {
  return {
    date: todayIso(),
    amount: 0,
    currency: 'EUR',
    rate: 1,
    category: 'essen',
    description: '',
    paidBy: '',
    splitAmong: [],
    receipt: null,
    ...over
  }
}

/** Auf Cent runden (vermeidet 0,1 + 0,2 = 0,30000000000000004). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/** Betrag in der Reisewährung. */
export function inTripCurrency(e: Pick<Expense, 'amount' | 'currency' | 'rate'>, tripCurrency: string): number {
  return round2(e.currency === tripCurrency ? e.amount : e.amount * (e.rate || 0))
}

/**
 * Schnelleingabe wie "12,50 Eis" oder "Pizza 23" → Betrag und Beschreibung.
 * Komma oder Punkt als Dezimaltrenner; Tausenderpunkte ("1.234,50") werden erkannt.
 */
export function parseQuickExpense(input: string): { amount: number; description: string } | null {
  const s = input.trim()
  const re = /(\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:[.,]\d{1,2})?)/
  const m = s.match(re)
  if (!m) return null
  let num = m[1]
  if (/\.\d{3}/.test(num) && (num.includes(',') || /^\d{1,3}(\.\d{3})+$/.test(num))) num = num.replace(/\./g, '')
  const amount = Number(num.replace(',', '.'))
  if (!Number.isFinite(amount) || amount <= 0) return null
  const description = (s.slice(0, m.index) + s.slice((m.index ?? 0) + m[1].length))
    .replace(/€|eur(o)?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  return { amount: round2(amount), description }
}

export function validateExpense(d: ExpenseDraft, tripCurrency: string): Partial<Record<keyof ExpenseDraft, string>> {
  const e: Partial<Record<keyof ExpenseDraft, string>> = {}
  if (!d.date) e.date = t('Bitte ein Datum wählen.')
  if (!(d.amount > 0)) e.amount = t('Betrag muss größer als 0 sein.')
  if (d.currency !== tripCurrency && !(d.rate > 0)) e.rate = t('Bitte einen Umrechnungskurs angeben.')
  return e
}

export interface ExpenseSummary {
  total: number
  byCategory: { category: ExpenseCategory; amount: number }[]
  byDay: { date: string; amount: number }[]
  /** Durchschnitt pro Reisetag bis heute (bzw. über die ganze Reise, wenn vorbei) */
  perDay: number
  /** Hochrechnung aufs Reiseende bei gleichem Tempo */
  projected: number
  /** Tage mit Ausgaben gezählt ab Reisebeginn bis heute (mind. 1) */
  daysElapsed: number
}

export function summarize(list: Expense[], tripCurrency: string, start: string, end: string, today: Date = new Date()): ExpenseSummary {
  const total = round2(list.reduce((s, e) => s + inTripCurrency(e, tripCurrency), 0))
  const cat = new Map<ExpenseCategory, number>()
  const day = new Map<string, number>()
  for (const e of list) {
    const v = inTripCurrency(e, tripCurrency)
    cat.set(e.category, (cat.get(e.category) ?? 0) + v)
    day.set(e.date, (day.get(e.date) ?? 0) + v)
  }
  const tripDays = diffDays(start, end) + 1
  const t = todayIso(today)
  const lastCounted = t < start ? start : t > end ? end : t
  const daysElapsed = Math.max(1, Math.min(tripDays, diffDays(start, lastCounted) + 1))
  const perDay = round2(total / daysElapsed)
  return {
    total,
    byCategory: [...cat.entries()].map(([category, amount]) => ({ category, amount: round2(amount) })).sort((a, b) => b.amount - a.amount),
    byDay: [...day.entries()].map(([date, amount]) => ({ date, amount: round2(amount) })).sort((a, b) => a.date.localeCompare(b.date)),
    perDay,
    projected: t > end ? total : round2(perDay * tripDays),
    daysElapsed
  }
}

export interface Balance {
  person: string
  paid: number
  share: number
  /** positiv = bekommt Geld zurück, negativ = schuldet */
  net: number
}

export interface Transfer {
  from: string
  to: string
  amount: number
}

/**
 * Wer hat wie viel bezahlt, wie viel war sein Anteil? Ausgaben ohne Zahler bleiben außen vor.
 * `splitAmong` leer = auf alle Teilnehmer verteilt.
 */
export function balances(list: Expense[], participants: string[], tripCurrency: string): Balance[] {
  const people = [...participants]
  const add = (p: string) => {
    if (p && !people.includes(p)) people.push(p)
  }
  list.forEach((e) => {
    add(e.paidBy)
    e.splitAmong.forEach(add)
  })
  const paid = new Map(people.map((p) => [p, 0]))
  const share = new Map(people.map((p) => [p, 0]))
  for (const e of list) {
    if (!e.paidBy) continue
    const v = inTripCurrency(e, tripCurrency)
    const among = e.splitAmong.length ? e.splitAmong : participants.length ? participants : [e.paidBy]
    paid.set(e.paidBy, (paid.get(e.paidBy) ?? 0) + v)
    for (const p of among) share.set(p, (share.get(p) ?? 0) + v / among.length)
  }
  return people.map((p) => {
    const pd = round2(paid.get(p) ?? 0)
    const sh = round2(share.get(p) ?? 0)
    return { person: p, paid: pd, share: sh, net: round2(pd - sh) }
  })
}

/** Möglichst wenige Überweisungen, damit alle quitt sind. */
export function settle(bal: Balance[]): Transfer[] {
  const debtors = bal.filter((b) => b.net < -0.005).map((b) => ({ p: b.person, v: -b.net })).sort((a, b) => b.v - a.v)
  const creditors = bal.filter((b) => b.net > 0.005).map((b) => ({ p: b.person, v: b.net })).sort((a, b) => b.v - a.v)
  const out: Transfer[] = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const amount = round2(Math.min(debtors[i].v, creditors[j].v))
    if (amount >= 0.01) out.push({ from: debtors[i].p, to: creditors[j].p, amount })
    debtors[i].v = round2(debtors[i].v - amount)
    creditors[j].v = round2(creditors[j].v - amount)
    if (debtors[i].v < 0.01) i++
    if (creditors[j].v < 0.01) j++
  }
  return out
}

/** Neueste zuerst, innerhalb des Tages nach Erfassung. */
export function sortExpenses(list: Expense[]): Expense[] {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
}

/** Datum für eine neue Ausgabe: heute während der Reise, sonst Reiseanfang/-ende. */
export function defaultExpenseDate(start: string, end: string, today: Date = new Date()): string {
  const t = todayIso(today)
  return t < start ? start : t > end ? end : t
}

