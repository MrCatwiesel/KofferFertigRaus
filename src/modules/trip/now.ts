/**
 * „Jetzt wichtig“ oben auf der Reiseseite (ab 2.0): höchstens drei Abkürzungen, die zur Reisephase passen.
 * Die Phase ordnet nur – alle Funktionen bleiben über die Gruppen erreichbar. Reine Logik (testbar).
 */
import type { Reminder } from '@/core/reminders'
import { t, tn } from '@/i18n'

export type NowPhase = 'vorher' | 'unterwegs' | 'danach'

/** Was die Logik über einen Bereich wissen muss */
export interface NowSection {
  moduleId: string
  title: string
  icon: string
  to: string
  summary: string
}

export interface NowCard {
  id: string
  title: string
  sub: string
  icon: string
  to: string
}

/** Tage zwischen zwei ISO-Daten (ohne Uhrzeit) */
function days(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

export function relDay(date: string, today: string): string {
  const d = days(today, date)
  if (d === 0) return t('heute')
  if (d === 1) return t('morgen')
  return tn(d, 'in 1 Tag', 'in {n} Tagen')
}

/** Phase aus dem Reisedatum (archivierte Reisen zählen als „danach“) */
export function nowPhaseOf(t: { startDate: string; endDate: string; archived?: boolean }, today: string): NowPhase {
  if (t.archived) return 'danach'
  if (days(today, t.startDate) > 0) return 'vorher'
  if (days(today, t.endDate) >= 0) return 'unterwegs'
  return 'danach'
}

export function nowCards(phase: NowPhase, sections: readonly NowSection[], reminders: readonly Reminder[], today: string): NowCard[] {
  const by = (id: string) => sections.find((s) => s.moduleId === id)
  const out: NowCard[] = []
  const add = (c: NowCard | null) => {
    if (c && out.length < 3 && !out.some((x) => x.id === c.id)) out.push(c)
  }
  const section = (id: string, title?: string, suffix = '') => {
    const s = by(id)
    return s ? { id, title: title ?? s.title, sub: s.summary, icon: s.icon, to: s.to + suffix } : null
  }
  const termine = by('termine')
  const reminder = (r: Reminder): NowCard => ({
    id: `r:${r.id}`,
    title: r.title,
    sub: [relDay(r.date, today), r.time].filter(Boolean).join(' · '),
    icon: 'alarm',
    to: r.to ?? termine?.to ?? ''
  })
  const upcoming = reminders.filter((r) => r.date >= today && (r.to || termine))

  if (phase === 'vorher') {
    upcoming.slice(0, 2).forEach((r) => add(reminder(r)))
    for (const id of ['packing', 'travel', 'accommodation', 'documents', 'checklisten']) add(section(id))
  } else if (phase === 'unterwegs') {
    const todays = upcoming.find((r) => r.date === today)
    add(section('dayplanner', t('Heute')))
    if (todays) add(reminder(todays))
    add(section('expenses', t('Ausgabe erfassen'), '/neu'))
    add(section('journal', t('Tagebuch schreiben'), '/neu'))
    add(section('map'))
  } else {
    add(section('journal', t('Tagebuch ergänzen')))
    add(section('report'))
    add(section('expenses', t('Abrechnen')))
    add(section('website'))
  }
  return out
}
