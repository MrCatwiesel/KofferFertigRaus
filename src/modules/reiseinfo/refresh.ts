/**
 * Reisehinweise für die Zielländer einer Reise holen, speichern und in die Dokumentenliste übernehmen.
 * Bei geändertem Stand des Auswärtigen Amts werden Einträge aktualisiert und als „geändert“ markiert.
 */
import { now } from '@/core/db'
import { countryName } from '@/core/countries'
import { tripRepository } from '@/modules/trip/public'
import { documentRepository } from '@/modules/documents/public'
import { fetchTravelWarning } from './api'
import { infoDocuments } from './logic'
import { parseTravelWarning } from './parse'
import { countryInfoRepository } from './repository'
import type { CountryInfo } from './types'

/** Nach so langer Zeit wird beim Öffnen der Reise automatisch neu nachgesehen */
export const STALE_MS = 24 * 3600_000

export interface RefreshResult {
  updated: string[]
  unchanged: string[]
  errors: string[]
}

const running = new Map<string, Promise<RefreshResult>>()

export function refreshTripInfos(tripId: string, force = false): Promise<RefreshResult> {
  const r = running.get(tripId) ?? run(tripId, force).finally(() => running.delete(tripId))
  running.set(tripId, r)
  return r
}

async function run(tripId: string, force: boolean): Promise<RefreshResult> {
  const result: RefreshResult = { updated: [], unchanged: [], errors: [] }
  const trip = await tripRepository.get(tripId)
  if (!trip) return result
  const wanted = trip.countries ?? []
  const existing = new Map((await countryInfoRepository.listByTrip(tripId)).map((i) => [i.country, i]))

  // Länder, die nicht mehr zur Reise gehören: Hinweise und automatische Dokumente entfernen
  for (const [c, info] of existing) {
    if (wanted.includes(c)) continue
    await countryInfoRepository.remove(info.id)
    await documentRepository.removeBySourcePrefix(tripId, `aa:${c}:`)
  }

  for (const c of wanted) {
    const old = existing.get(c)
    if (!force && old && Date.now() - Date.parse(old.fetchedAt) < STALE_MS) {
      result.unchanged.push(c)
      continue
    }
    try {
      const parsed = parseTravelWarning(await fetchTravelWarning(c))
      const changed = !old || old.lastModified !== parsed.lastModified
      const ts = now()
      const info: CountryInfo = {
        ...parsed,
        country: c,
        countryName: parsed.countryName || countryName(c),
        id: `${tripId}:${c}`,
        tripId,
        fetchedAt: ts,
        unseenChange: old ? changed || old.unseenChange : false,
        createdAt: old?.createdAt ?? ts,
        updatedAt: ts
      }
      await countryInfoRepository.put(info)
      for (const d of infoDocuments(info)) await documentRepository.upsertBySource(tripId, d.source, d)
      ;(changed ? result.updated : result.unchanged).push(c)
    } catch (e) {
      result.errors.push(`${countryName(c)}: ${(e as Error).message}`)
    }
  }
  return result
}

/** Im Hintergrund nachsehen, wenn online und lange nicht geprüft */
export async function refreshIfStale(tripId: string): Promise<void> {
  if (!navigator.onLine) return
  const trip = await tripRepository.get(tripId)
  if (!trip?.countries?.length) return
  const infos = await countryInfoRepository.listByTrip(tripId)
  const stale = trip.countries.some((c) => {
    const i = infos.find((x) => x.country === c)
    return !i || Date.now() - Date.parse(i.fetchedAt) > STALE_MS
  })
  if (stale) await refreshTripInfos(tripId)
}
