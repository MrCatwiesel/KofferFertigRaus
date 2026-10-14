/** Warnungen einer Reise holen und speichern; Orte aus Unterkünften, Wetter-Ort oder Reiseziel. */
import { todayIso } from '@/core/dates'
import { getMeta, setMeta } from '@/core/meta'
import { tripRepository, type Trip } from '@/modules/trip/public'
import { accommodationRepository } from '@/modules/accommodation/public'
import { placeRepository } from '@/modules/map/public'
import { weatherRepository } from '@/modules/dayplanner/public'
import { searchPlaces } from '@/services/weather'
import { fetchUnwetter } from './api'
import { imZeitfenster, reiseOrte } from './logic'
import { unwetterRepository } from './repository'
import type { UnwetterOrt, UnwetterStand } from './types'

/** Nach so langer Zeit wird beim Öffnen neu nachgesehen */
export const STALE_MS = 30 * 60_000

type Ziel = { name: string; lat: number; lon: number } | null

/** Orte der Reise; sucht das Reiseziel einmal als Ort (gemerkt auf dem Gerät), wenn sonst keiner bekannt ist */
export async function orteDerReise(trip: Trip): Promise<UnwetterOrt[]> {
  const [accs, places, weather] = await Promise.all([accommodationRepository.listByTrip(trip.id), placeRepository.listByTrip(trip.id), weatherRepository.get(trip.id)])
  const unterkuenfte = accs
    .filter((a) => a.status !== 'storniert')
    .flatMap((a) => {
      const p = places.find((x) => x.kind === 'accommodation' && x.refId === a.id)
      return p ? [{ name: a.name, lat: p.lat, lon: p.lon, checkIn: a.checkIn, checkOut: a.checkOut }] : []
    })
  const wetter = weather ? { name: weather.place.name, lat: weather.place.latitude, lon: weather.place.longitude } : null
  let ziel: Ziel = null
  if (!unterkuenfte.length && !wetter && trip.destination.trim()) {
    const key = `unwetter.ziel.${trip.id}`
    const saved = await getMeta<{ query: string; ort: Ziel } | null>(key, null)
    if (saved?.query === trip.destination) ziel = saved.ort
    else if (navigator.onLine) {
      try {
        const p = (await searchPlaces(trip.destination.split(/[,(]/)[0]))[0]
        ziel = p ? { name: p.name, lat: p.latitude, lon: p.longitude } : null
        await setMeta(key, { query: trip.destination, ort: ziel })
      } catch {
        /* beim nächsten Mal wieder versuchen */
      }
    }
  }
  return reiseOrte({ trip, unterkuenfte, wetter, ziel })
}

const running = new Map<string, Promise<UnwetterStand | null>>()

/** Holen und speichern; null, wenn die Reise keinen Ort und kein Land hat */
export function refreshUnwetter(tripId: string): Promise<UnwetterStand | null> {
  const r = running.get(tripId) ?? run(tripId).finally(() => running.delete(tripId))
  running.set(tripId, r)
  return r
}

async function run(tripId: string): Promise<UnwetterStand | null> {
  const trip = await tripRepository.get(tripId)
  if (!trip) return null
  const orte = await orteDerReise(trip)
  const laender = trip.countries ?? []
  if (!orte.length && !laender.length) return null
  const a = await fetchUnwetter(orte, laender)
  const stand: UnwetterStand = {
    tripId,
    fetchedAt: new Date().toISOString(),
    orte: orte.map((o, i) => ({ ...o, regionen: a.orte[i]?.regionen ?? [] })),
    warnungen: a.warnungen,
    ohneDaten: a.ohneDaten,
    fehler: a.fehler
  }
  await unwetterRepository.put(stand)
  return stand
}

/** Im Hintergrund, wenn online, die Reise bald beginnt oder läuft und lange nicht geprüft wurde */
export async function refreshIfStale(tripId: string): Promise<void> {
  if (!navigator.onLine) return
  const trip = await tripRepository.get(tripId)
  if (!trip || trip.archived || !imZeitfenster(trip, todayIso())) return
  const s = await unwetterRepository.get(tripId)
  if (s && Date.now() - Date.parse(s.fetchedAt) < STALE_MS) return
  await refreshUnwetter(tripId)
}
