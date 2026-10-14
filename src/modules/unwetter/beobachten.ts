/**
 * Beobachtungsliste für die Push-Benachrichtigungen: laufende und kommende Reisen mit Zielland, Orten und Regionen.
 * Der Server prüft damit alle 15 Minuten MeteoAlarm und schickt neue Warnungen – auch wenn die App geschlossen ist.
 */
import { watch } from 'vue'
import { getMeta, setMeta } from '@/core/meta'
import { pushState } from '@/core/push'
import { todayIso } from '@/core/dates'
import { ServerClient } from '@/core/sync/client'
import { syncState } from '@/core/sync/engine'
import { tripRepository } from '@/modules/trip/public'
import { settingsOf } from './logic'
import { watchOf } from './api'

const META_HASH = 'unwetter.beobachten.hash'

export async function buildWatchItems(today = todayIso()) {
  const trips = (await tripRepository.listAll()).filter((t) => !t.archived && t.endDate >= today && t.countries?.length && settingsOf(t).scope !== 'aus')
  const items = []
  for (const t of trips.slice(0, 50)) {
    items.push({ trip: t.id, title: t.title, countries: t.countries, from: t.startDate, to: t.endDate, ...(await watchOf(t)) })
  }
  return items
}

const hashOf = (s: string) => {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0
  return `${s.length}:${h}`
}

/** Hochladen, wenn sich etwas geändert hat (oder `force`) – nur, wenn irgendein Gerät der Person Benachrichtigungen hat */
export async function uploadWatch(force = false): Promise<boolean> {
  if (!pushState.active && !pushState.scheduleWanted) return false
  const client = await ServerClient.fromSync()
  if (!client) return false
  const items = await buildWatchItems()
  const hash = hashOf(`${todayIso()}|${JSON.stringify(items)}`)
  if (!force && hash === (await getMeta(META_HASH, ''))) return false
  try {
    await client.json('/api/unwetter/beobachten', 'PUT', { items })
  } catch (e) {
    if ((e as { status?: number }).status === 404) return false // Server älter als 1.19
    throw e
  }
  await setMeta(META_HASH, hash)
  return true
}

/** Nach jedem Abgleich und nach dem Einschalten der Benachrichtigungen im Hintergrund aktualisieren */
export function startWatchUpload(): void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const later = (force = false) => {
    clearTimeout(timer)
    timer = setTimeout(() => void uploadWatch(force).catch(() => false), 8000)
  }
  watch(() => syncState.lastSync, () => later())
  watch(() => pushState.active || pushState.scheduleWanted, (on) => on && later(true))
}
