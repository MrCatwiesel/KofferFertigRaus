/**
 * Reisehinweise für die Zielländer einer Reise holen, speichern und in die Dokumentenliste übernehmen.
 * Bei geändertem Stand des Auswärtigen Amts werden Einträge aktualisiert und als „geändert“ markiert.
 */
import { now } from '@/core/db'
import { countryName } from '@/core/countries'
import { tripRepository } from '@/modules/trip/public'
import { contactRepository, documentRepository } from '@/modules/documents/public'
import { fetchMissions, fetchTravelWarning } from './api'
import { infoDocuments, missionContacts } from './logic'
import { parseMissions, parseTravelWarning } from './parse'
import { countryInfoRepository } from './repository'
import type { CountryInfo } from './types'

/** Nach so langer Zeit wird beim Öffnen der Reise automatisch neu nachgesehen */
export const STALE_MS = 24 * 3600_000

export interface RefreshResult {
  updated: string[]
  unchanged: string[]
  errors: string[]
}

/** Lange nicht geprüft – oder noch ohne Auslandsvertretungen (vor Version 1.14 abgerufen) */
const isStale = (i: CountryInfo) => Date.now() - Date.parse(i.fetchedAt) > STALE_MS || i.missions === undefined

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
    await contactRepository.removeBySourcePrefix(tripId, `aa:${c}:`)
  }

  for (const c of wanted) {
    const old = existing.get(c)
    if (!force && old && !isStale(old)) {
      // Reiseziel kann sich geändert haben (Honorarkonsul am Ort) – Notfallnummern aus dem Gespeicherten abgleichen
      await contactRepository.syncBySource(tripId, `aa:${c}:vertretung:`, missionContacts(old, trip.destination))
      result.unchanged.push(c)
      continue
    }
    try {
      const parsed = parseTravelWarning(await fetchTravelWarning(c))
      // Auslandsvertretungen: Fehler hier sollen die Reisehinweise nicht verhindern – dann die bisherigen behalten
      let missions = old?.missions
      try {
        missions = parseMissions(await fetchMissions(c, parsed.countryName || countryName(c)))
      } catch {
        /* bisherige behalten */
      }
      const changed = !old || old.lastModified !== parsed.lastModified
      const ts = now()
      const info: CountryInfo = {
        ...parsed,
        missions,
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
      if (missions) await contactRepository.syncBySource(tripId, `aa:${c}:vertretung:`, missionContacts(info, trip.destination))
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
    return !i || isStale(i)
  })
  if (stale) await refreshTripInfos(tripId)
}
