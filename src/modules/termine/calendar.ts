/**
 * Kalender: Termine und Fristen als Datei (einmalig) oder als Abo über den eigenen Server (aktualisiert sich selbst).
 */
import { watch } from 'vue'
import { getMeta, setMeta } from '@/core/meta'
import { getReminders } from '@/core/registry'
import { buildIcs, type Reminder, type ReminderTrip } from '@/core/reminders'
import { todayIso } from '@/core/dates'
import { ServerClient } from '@/core/sync/client'
import { syncState } from '@/core/sync/engine'
import { tripRepository, type Trip } from '@/modules/trip/public'
import { t } from '@/core/i18n'

const META_ABO = 'kalender.abo'
const META_HASH = 'kalender.hash'

export const asReminderTrip = (t: Trip): ReminderTrip => ({ id: t.id, title: t.title, destination: t.destination, startDate: t.startDate, endDate: t.endDate })

/** Adresse der App (für Links in den Kalendereinträgen) */
const appUrl = () => `${location.origin}${location.pathname}`

/** Termine einer Reise, Name der Reise vorangestellt (im Kalender sieht man sonst nicht, zu welcher Reise es gehört) */
export async function remindersOfTrip(trip: Trip, today = todayIso()): Promise<Reminder[]> {
  const list = await getReminders(asReminderTrip(trip), today)
  return list.map((r) => (r.id === `trip:${trip.id}` ? r : { ...r, detail: [r.detail, t('Reise: {0}', [trip.title])].filter(Boolean).join('\n') }))
}

export async function tripIcs(trip: Trip): Promise<string> {
  return buildIcs(await remindersOfTrip(trip), { name: t('{0} – Nix wie weg', [trip.title]), appUrl: appUrl() })
}

/** Alle laufenden und kommenden Reisen (nicht archiviert, höchstens 30 Tage vorbei) */
export async function allIcs(): Promise<string> {
  const today = todayIso()
  const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)
  const trips = (await tripRepository.listAll()).filter((t) => !t.archived && t.endDate >= cutoff)
  const all: Reminder[] = []
  for (const t of trips) all.push(...(await remindersOfTrip(t, today)))
  return buildIcs(all, { name: t('Nix wie weg – Reisen'), appUrl: appUrl() })
}

/** Kalenderdatei teilen (iPad: „Zum Kalender hinzufügen“) oder herunterladen */
export async function shareIcs(ics: string, filename: string): Promise<void> {
  const file = new File([ics], filename, { type: 'text/calendar' })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename })
      return
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(file)
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}

// ---------------------------------------------------------------- Abo über den Server

export interface AboStatus {
  token: string | null
  updated: string | null
}

/** https- und webcal-Adresse des Abos */
export function aboUrls(server: string, token: string) {
  const https = `${server.replace(/\/+$/, '')}/api/kalender/${token}.ics`
  return { https, webcal: https.replace(/^https?:/, 'webcal:') }
}

/** Prüfsumme ohne Zeitstempel (DTSTAMP ändert sich bei jedem Erzeugen) */
export function icsHash(ics: string): string {
  const s = ics.replace(/^DTSTAMP:.*\r?\n/gm, '')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(16)
}

export async function aboStatus(): Promise<{ client: ServerClient; status: AboStatus } | null> {
  const client = await ServerClient.fromSync()
  if (!client) return null
  return { client, status: await client.json<AboStatus>('/api/kalender') }
}

/** Kalender hochladen, wenn sich etwas geändert hat (oder `force`) */
export async function uploadCalendar(force = false): Promise<boolean> {
  if (!(await getMeta(META_ABO, false))) return false
  const client = await ServerClient.fromSync()
  if (!client) return false
  const ics = await allIcs()
  const hash = icsHash(ics)
  if (!force && hash === (await getMeta(META_HASH, ''))) return false
  await client.request('/api/kalender', { method: 'PUT', headers: { 'Content-Type': 'text/calendar; charset=utf-8' }, body: ics })
  await setMeta(META_HASH, hash)
  return true
}

export async function enableAbo(renew = false): Promise<AboStatus> {
  const client = await ServerClient.fromSync()
  if (!client) throw new Error(t('Dafür muss der Geräte-Abgleich mit dem eigenen Server eingerichtet sein.'))
  let status = await client.json<AboStatus>('/api/kalender')
  if (!status.token || renew) status = await client.json<AboStatus>('/api/kalender/link', 'POST')
  await setMeta(META_ABO, true)
  await uploadCalendar(true)
  return client.json<AboStatus>('/api/kalender')
}

export async function disableAbo(): Promise<void> {
  const client = await ServerClient.fromSync()
  if (client) await client.json('/api/kalender/link', 'DELETE')
  await setMeta(META_ABO, false)
  await setMeta(META_HASH, '')
}

/** Nach jedem Abgleich (und beim Start) im Hintergrund aktualisieren */
export function startCalendarSync(): void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const later = () => {
    clearTimeout(timer)
    timer = setTimeout(() => void uploadCalendar().catch(() => false), 5000)
  }
  watch(() => syncState.lastSync, later)
  later()
}
