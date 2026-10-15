/**
 * Zeitplan der Push-Benachrichtigungen: Termine und Fristen aller laufenden und kommenden Reisen
 * mit Zeitpunkt (Beginn minus Vorwarnung) an den Server – er schickt sie dann zur richtigen Zeit.
 */
import { watch } from 'vue'
import { getMeta, setMeta } from '@/core/meta'
import { pushState } from '@/core/push'
import { pushItems, type Reminder } from '@/core/reminders'
import { todayIso } from '@/core/dates'
import { ServerClient } from '@/core/sync/client'
import { syncState } from '@/core/sync/engine'
import { tripRepository } from '@/modules/trip/public'
import { icsHash, remindersOfTrip } from './calendar'

const META_HASH = 'push.zeitplan.hash'

export async function buildPushSchedule(now = new Date()) {
  const today = todayIso(now)
  const trips = (await tripRepository.listAll()).filter((t) => !t.archived && !t.sample && t.endDate >= today)
  const all: Reminder[] = []
  for (const t of trips) all.push(...(await remindersOfTrip(t, today)))
  return pushItems(all, now)
}

/** Hochladen, wenn sich etwas geändert hat (oder `force`) – nur, wenn die Person irgendwo Erinnerungen eingeschaltet hat */
export async function uploadPushSchedule(force = false): Promise<boolean> {
  if (!pushState.active && !pushState.scheduleWanted) return false
  const client = await ServerClient.fromSync()
  if (!client) return false
  const items = await buildPushSchedule()
  const hash = icsHash(JSON.stringify(items))
  if (!force && hash === (await getMeta(META_HASH, ''))) return false
  await client.json('/api/benachrichtigungen/zeitplan', 'PUT', { items })
  await setMeta(META_HASH, hash)
  return true
}

/** Nach jedem Abgleich und nach dem Einschalten im Hintergrund aktualisieren */
export function startPushSchedule(): void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const later = (force = false) => {
    clearTimeout(timer)
    timer = setTimeout(() => void uploadPushSchedule(force).catch(() => false), 6000)
  }
  watch(() => syncState.lastSync, () => later())
  watch(() => pushState.active || pushState.scheduleWanted, (on) => on && later(true))
}
