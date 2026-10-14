/**
 * Push bei Unwetter: Die Orte aller laufenden und kommenden Reisen (Unterkünfte, Wetter-Ort, Reiseziel)
 * mit Zeitraum an den Server – er prüft alle 10 Minuten und schickt neue Warnungen an die Geräte der Person.
 */
import { watch } from 'vue'
import { getMeta, setMeta } from '@/core/meta'
import { pushState } from '@/core/push'
import { addDays, todayIso } from '@/core/dates'
import { ServerClient } from '@/core/sync/client'
import { syncState } from '@/core/sync/engine'
import { tripRepository } from '@/modules/trip/public'
import { orteDerReise } from './refresh'

const META_HASH = 'unwetter.beobachten.hash'

export async function beobachtungsListe(now = new Date()) {
  const today = todayIso(now)
  // Reisen, die laufen oder in den nächsten 14 Tagen beginnen
  const trips = (await tripRepository.listAll()).filter((t) => !t.archived && t.endDate >= today && t.startDate <= addDays(today, 14))
  const orte = []
  for (const t of trips) {
    for (const o of await orteDerReise(t)) orte.push({ reise: t.id, titel: t.title, name: o.name, lat: Math.round(o.lat * 1e4) / 1e4, lon: Math.round(o.lon * 1e4) / 1e4, von: o.von, bis: o.bis })
  }
  return orte.slice(0, 100)
}

/** Hochladen, wenn sich etwas geändert hat – nur, wenn die Person irgendwo Unwetter-Push eingeschaltet hat */
export async function uploadBeobachtung(force = false): Promise<boolean> {
  // Server zählt die Geräte der Person mit eingeschalteten Unwetterwarnungen (auch dieses)
  if (!((pushState.status?.unwetter ?? 0) > 0)) return false
  const client = await ServerClient.fromSync()
  if (!client) return false
  const orte = await beobachtungsListe()
  const zeitzone = Intl.DateTimeFormat().resolvedOptions().timeZone
  const hash = JSON.stringify({ orte, zeitzone })
  if (!force && hash === (await getMeta(META_HASH, ''))) return false
  await client.json('/api/unwetter/beobachten', 'PUT', { orte, zeitzone })
  await setMeta(META_HASH, hash)
  return true
}

/** Nach jedem Abgleich, einmal täglich (neue Reise rückt ins Zeitfenster) und nach dem Einschalten */
export function startBeobachtung(): void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const later = (force = false) => {
    clearTimeout(timer)
    timer = setTimeout(() => void uploadBeobachtung(force).catch(() => false), 8000)
  }
  watch(() => syncState.lastSync, () => later())
  watch(() => (pushState.status?.unwetter ?? 0) > 0, (on) => on && later(true))
}
