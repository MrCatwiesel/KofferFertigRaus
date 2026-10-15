import { shiftDate, type Reminder, type ReminderTrip } from '@/core/reminders'
import { t, tn } from '@/i18n'
import type { ChecklistItem, ChecklistKind } from './types'

/** Was die Checklisten von Unterkünften und Etappen brauchen (aus deren public.ts) */
export interface StayInfo {
  id: string
  name: string
  type: string
  status: string
  checkOut: string
}
export interface LegInfo {
  id: string
  mode: string
  direction: string
  from: string
  to: string
  date: string
  departTime: string
}

export const checkinId = (tripId: string, legId: string) => `${tripId}:checkin:${legId}`

export function itemsOf(items: ChecklistItem[], list: ChecklistKind, ref = ''): ChecklistItem[] {
  return items.filter((i) => i.list === list && i.ref === ref).sort((a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt))
}

export function progress(items: ChecklistItem[]): { done: number; total: number } {
  return { done: items.filter((i) => i.done).length, total: items.length }
}

/** Gebuchte Unterkünfte mit Abreisetag, nach Abreise sortiert */
export function checkoutStays<T extends StayInfo>(stays: T[]): T[] {
  return stays.filter((s) => s.status === 'gebucht' && s.checkOut).sort((a, b) => a.checkOut.localeCompare(b.checkOut))
}

/** Flüge mit Datum, nach Abflug sortiert */
export function flights<T extends LegInfo>(legs: T[]): T[] {
  return legs.filter((l) => l.mode === 'flug' && l.date).sort((a, b) => (a.date + a.departTime).localeCompare(b.date + b.departTime))
}

export function legRoute(l: LegInfo): string {
  return [l.from, l.to].filter(Boolean).join(' → ') || (l.direction === 'hin' ? t('Anreise') : t('Rückreise'))
}

/** Texte, die noch nicht in der Liste stehen (Groß-/Kleinschreibung egal) */
export function missingTexts(existing: ChecklistItem[], texts: string[]): string[] {
  const have = new Set(existing.map((i) => i.text.trim().toLowerCase()))
  const out: string[] = []
  for (const x of texts.map((s) => s.trim()).filter(Boolean)) {
    if (have.has(x.toLowerCase())) continue
    have.add(x.toLowerCase())
    out.push(x)
  }
  return out
}

/**
 * Erinnerungen: offene Punkte „zu Hause“ am Tag vor der Abreise, Auschecken am Abreisetag jeder Unterkunft,
 * Online-Check-in am Tag vor jedem Flug – jeweils nur, solange nicht erledigt.
 */
export function checklistReminders(trip: ReminderTrip, today: string, items: ChecklistItem[], stays: StayInfo[], legs: LegInfo[]): Reminder[] {
  const out: Reminder[] = []
  const to = `/trip/${trip.id}/checklisten`

  const home = itemsOf(items, 'zuhause')
  const homeOpen = home.length - progress(home).done
  if (homeOpen > 0 && trip.startDate && today <= trip.startDate)
    out.push({
      id: `chk:${trip.id}:zuhause`, tripId: trip.id, date: shiftDate(trip.startDate, -1), kind: 'pruefen',
      title: tn(homeOpen, 'Bevor es losgeht: 1 Punkt offen', 'Bevor es losgeht: {n} Punkte offen'), to
    })

  for (const s of checkoutStays(stays)) {
    if (s.checkOut < today) continue
    const list = itemsOf(items, 'auschecken', s.id)
    const open = list.length - progress(list).done
    if (list.length && !open) continue
    out.push({
      id: `chk:${s.id}:auschecken`, tripId: trip.id, date: s.checkOut, kind: 'pruefen',
      title: t('Auschecken: {name}', { name: s.name }),
      detail: list.length ? tn(open, '1 Punkt offen', '{n} Punkte offen') : t('Checkliste vor der Abreise aus der Unterkunft'), to
    })
  }

  for (const l of flights(legs)) {
    if (items.some((i) => i.id === checkinId(trip.id, l.id) && i.done)) continue
    // Gleiche Kennung wie früher im Modul „Anreise“ – Kalender-Einträge bleiben dieselben
    out.push({
      id: `leg:${l.id}:checkin`, tripId: trip.id, date: shiftDate(l.date, -1), time: l.departTime || undefined, kind: 'frist',
      title: t('Online-Check-in: {route}', { route: legRoute(l) }), alarmMinutes: 0, to
    })
  }
  return out
}

/** Kurzfassung für die Reiseseite */
export function checklistSummary(items: ChecklistItem[], stays: StayInfo[], legs: LegInfo[], tripId: string): string {
  const parts: string[] = []
  const home = progress(itemsOf(items, 'zuhause'))
  if (home.total) parts.push(t('Zu Hause {done}/{total}', home))
  const fl = flights(legs)
  if (fl.length) parts.push(t('Check-in {done}/{total}', { done: fl.filter((l) => items.some((i) => i.id === checkinId(tripId, l.id) && i.done)).length, total: fl.length }))
  for (const s of checkoutStays(stays)) {
    const p = progress(itemsOf(items, 'auschecken', s.id))
    if (p.total) parts.push(t('{name} {done}/{total}', { name: s.name, ...p }))
  }
  return parts.length ? parts.join(' · ') : t('Zu Hause, Auschecken, Online-Check-in – abhaken, nichts vergessen')
}
