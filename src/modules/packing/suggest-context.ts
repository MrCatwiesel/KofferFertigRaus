/**
 * Daten für die Packvorschläge zusammentragen (Reise, Anreise, Unternehmungen, Routen, Unterkünfte, Reisehinweise, Wetter).
 */
import { todayIso } from '@/core/dates'
import { accommodationRepository } from '@/modules/accommodation/public'
import { activityRepository } from '@/modules/activity/public'
import { weatherRepository } from '@/modules/dayplanner/public'
import { placeRepository } from '@/modules/map/public'
import { countryInfoRepository } from '@/modules/reiseinfo/public'
import { routeRepository } from '@/modules/routes/public'
import { travelRepository } from '@/modules/travel/public'
import { participantsOf, tripDays, type Trip } from '@/modules/trip/public'
import { coverMotif } from '@/ui/cover-art'
import { fetchOutlook, searchPlaces, type WeatherOutlook } from '@/services/weather'
import type { SuggestContext } from './suggest'

/** Ort für das Wetter: im Tagesplaner gewählt → verortete Unterkunft → Suche nach dem Reiseziel */
async function locate(trip: Trip): Promise<{ lat: number; lon: number; name: string } | null> {
  const w = await weatherRepository.get(trip.id)
  if (w?.place) return { lat: w.place.latitude, lon: w.place.longitude, name: w.place.name }
  const places = await placeRepository.listByTrip(trip.id)
  const stay = places.find((p) => p.kind === 'accommodation') ?? places[0]
  if (stay) return { lat: stay.lat, lon: stay.lon, name: stay.label }
  const parts = trip.destination.split(/[,·]/).map((s) => s.trim()).filter(Boolean)
  for (const q of [trip.destination, ...parts]) {
    try {
      const hit = (await searchPlaces(q))[0]
      if (hit) return { lat: hit.latitude, lon: hit.longitude, name: hit.name }
    } catch {
      return null // offline
    }
  }
  return null
}

const outlookCache = new Map<string, Promise<WeatherOutlook | null>>()

/** Wetter-Aussicht (je Reise und Tag zwischengespeichert) */
export function outlookFor(trip: Trip): Promise<WeatherOutlook | null> {
  const key = `${trip.id}:${trip.startDate}:${trip.endDate}:${todayIso()}`
  if (!outlookCache.has(key))
    outlookCache.set(
      key,
      (async () => {
        if (!navigator.onLine) return null
        const at = await locate(trip)
        return at ? fetchOutlook(at.lat, at.lon, trip.startDate, trip.endDate, todayIso()).catch(() => null) : null
      })()
    )
  return outlookCache.get(key)!
}

export async function suggestContext(trip: Trip, withWeather = true): Promise<SuggestContext> {
  const [legs, acts, routes, stays, infos] = await Promise.all([
    travelRepository.listByTrip(trip.id),
    activityRepository.listByTrip(trip.id),
    routeRepository.listByTrip(trip.id),
    accommodationRepository.listByTrip(trip.id),
    countryInfoRepository.listByTrip(trip.id)
  ])
  const liveActs = acts.filter((a) => a.status !== 'verworfen')
  const eles = routes.map((r) => r.stats.maxEle).filter((e): e is number => e !== null)
  return {
    days: tripDays(trip.startDate, trip.endDate),
    travelers: trip.participants?.length || trip.travelers,
    participants: participantsOf(trip),
    countries: trip.countries ?? [],
    transit: trip.transit ?? [],
    transport: trip.transport,
    legModes: legs.map((l) => l.mode),
    outlook: withWeather ? await outlookFor(trip) : null,
    activityCategories: [...new Set(liveActs.map((a) => a.category))],
    activityText: liveActs.map((a) => `${a.title} ${a.place}`).join(' · '),
    hasRoutes: routes.length > 0,
    maxElevation: eles.length ? Math.max(...eles) : null,
    accommodationTypes: [...new Set(stays.filter((s) => s.status !== 'storniert').map((s) => s.type))],
    seaside: coverMotif(trip.destination) === 'meer',
    healthText: infos.flatMap((i) => i.sections.filter((s) => /gesundheit/i.test(s.title)).flatMap((s) => s.parts.map((p) => p.text))).join('\n')
  }
}
