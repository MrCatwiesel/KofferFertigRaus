import { db, newId, now } from '@/core/db'
import { notifyTripDeleted } from '@/core/registry'
import type { Trip, TripDraft } from './types'

/** Datenzugriff des Moduls – Views greifen nie direkt auf die Datenbank zu. */
export const tripRepository = {
  listAll(): Promise<Trip[]> {
    return db.trips.orderBy('startDate').reverse().toArray()
  },

  get(id: string): Promise<Trip | undefined> {
    return db.trips.get(id)
  },

  async create(draft: TripDraft): Promise<string> {
    const ts = now()
    const trip: Trip = { ...draft, id: newId(), createdAt: ts, updatedAt: ts }
    await db.trips.add(trip)
    return trip.id
  },

  /** Mit fester ID anlegen (Beispielreise: die anderen Module kennen die ID schon) */
  async createWithId(id: string, draft: TripDraft): Promise<void> {
    const ts = now()
    await db.trips.add({ ...draft, id, createdAt: ts, updatedAt: ts })
  },

  async update(id: string, draft: TripDraft): Promise<void> {
    await db.trips.update(id, { ...draft, updatedAt: now() })
  },

  /** Titelbild setzen (null = wieder die gezeichnete Landschaft) und Ausschnitt */
  async setCover(id: string, cover: Blob | null, coverY = 50): Promise<void> {
    await db.trips.update(id, { cover, coverY, updatedAt: now() })
  },

  /** Durchreiseländer (Modul „Länder-Spickzettel“) */
  async setTransit(id: string, transit: string[]): Promise<void> {
    await db.trips.update(id, { transit: [...transit], updatedAt: now() })
  },

  /** Einstellung der Unwetterwarnungen (Modul „Unwetter“) */
  async setWeatherAlerts(id: string, weatherAlerts: NonNullable<Trip['weatherAlerts']>): Promise<void> {
    await db.trips.update(id, { weatherAlerts: JSON.parse(JSON.stringify(weatherAlerts)), updatedAt: now() })
  },

  async setArchived(id: string, archived: boolean): Promise<void> {
    await db.trips.update(id, { archived, updatedAt: now() })
  },

  /** Löscht die Reise und lässt alle Module ihre zugehörigen Daten entfernen. */
  async remove(id: string): Promise<void> {
    await notifyTripDeleted(id)
    await db.trips.delete(id)
  }
}

// Leerer Entwurf liegt in logic.ts (ohne Datenbank testbar).
export { emptyTripDraft } from './logic'
