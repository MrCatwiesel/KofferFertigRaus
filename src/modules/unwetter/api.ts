/**
 * Unwetterwarnungen abrufen (über den eigenen Server, der MeteoAlarm fragt) und auf dem Gerät merken.
 * Die Reise liefert Länder, Orte und Ortsnamen – der Server ordnet zu, welche Warnungen „unsere“ sind.
 */
import { countryName } from '@/core/countries'
import { deleteMeta, getMeta, setMeta } from '@/core/meta'
import { todayIso } from '@/core/dates'
import { ServerClient, type ServerError } from '@/core/sync/client'
import { accommodationRepository } from '@/modules/accommodation/public'
import { weatherRepository } from '@/modules/dayplanner/public'
import { placeRepository } from '@/modules/map/public'
import { tripRepository, type Trip } from '@/modules/trip/public'
import { buildWatch, inWatchWindow, settingsOf } from './logic'
import type { CountryWarnings, WarningCache, Watch } from './types'
import { t } from '@/i18n'

const metaKey = (tripId: string) => `unwetter.${tripId}`
/** Automatisch höchstens alle 30 Minuten neu holen */
const STALE_MS = 30 * 60_000

export const NO_SERVER = t('Unwetterwarnungen kommen über den eigenen Server – erst den Geräte-Abgleich einrichten.')
export const OLD_SERVER = t('Der Server kennt noch keine Unwetterwarnungen. Bitte auf Version 1.19 aktualisieren (im Container: update.sh).')

export const getCache = (tripId: string) => getMeta<WarningCache | null>(metaKey(tripId), null)
export const removeCache = (tripId: string) => deleteMeta(metaKey(tripId))

const namesIn = (lang: string) => {
  try {
    const dn = new Intl.DisplayNames([lang], { type: 'region' })
    return (c: string) => dn.of(c) ?? ''
  } catch {
    return () => ''
  }
}
const englishNames = namesIn('en')
const germanNames = namesIn('de')

/** Orte, Ortsnamen und gewählte Regionen der Reise */
export async function watchOf(trip: Trip): Promise<Watch> {
  const [places, weather, accommodations] = await Promise.all([
    placeRepository.listByTrip(trip.id),
    weatherRepository.get(trip.id),
    accommodationRepository.listByTrip(trip.id)
  ])
  const countries = trip.countries ?? []
  return buildWatch(settingsOf(trip), {
    destination: trip.destination,
    countryNames: [...countries.map(countryName), ...countries.map(germanNames), ...countries.map(englishNames), 'Deutschland', 'Germany'],
    places,
    weatherPlace: weather?.place ?? null,
    addresses: accommodations.map((a) => a.address)
  })
}

/** Jetzt abrufen und merken. Wirft einen verständlichen Fehler, wenn es gar nicht geht. */
export async function checkTrip(tripId: string): Promise<WarningCache> {
  const client = await ServerClient.fromSync()
  if (!client) throw new Error(NO_SERVER)
  const trip = await tripRepository.get(tripId)
  if (!trip) throw new Error(t('Reise nicht gefunden.'))
  const watch = await watchOf(trip)
  const countries: CountryWarnings[] = []
  const errors: WarningCache['errors'] = []
  for (const country of trip.countries ?? []) {
    try {
      countries.push(await client.json<CountryWarnings>('/api/unwetter/pruefen', 'POST', { country, ...watch }))
    } catch (e) {
      const err = e as ServerError
      // 404 mit Hinweis „land“: MeteoAlarm kennt das Land nicht; 404 ohne: Server zu alt
      if (err.status === 404 && /MeteoAlarm/.test(err.message)) errors.push({ country, message: err.message, unsupported: true })
      else if (err.status === 404) throw new Error(OLD_SERVER)
      else errors.push({ country, message: err.message })
    }
  }
  // Nichts bekommen (z. B. offline) → das Gemerkte behalten
  const old = await getCache(tripId)
  if (!countries.length && errors.some((x) => !x.unsupported) && old?.countries.length) {
    const kept = { ...old, errors }
    await setMeta(metaKey(tripId), kept)
    return kept
  }
  const cache: WarningCache = { tripId, checkedAt: new Date().toISOString(), countries, errors }
  await setMeta(metaKey(tripId), cache)
  return cache
}

/** Im Hintergrund aktuell halten (rund um die Reise, höchstens alle 30 Minuten) */
export async function refreshIfStale(tripId: string): Promise<void> {
  const trip = await tripRepository.get(tripId)
  if (!trip?.countries?.length || settingsOf(trip).scope === 'aus' || !inWatchWindow(trip, todayIso())) return
  if (!navigator.onLine || !(await ServerClient.fromSync())) return
  const cache = await getCache(tripId)
  if (cache && Date.now() - Date.parse(cache.checkedAt) < STALE_MS) return
  await checkTrip(tripId)
}
