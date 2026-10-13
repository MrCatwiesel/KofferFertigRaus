import Dexie, { type Table } from 'dexie'
import { DATA_TABLES } from './tables'
import { changeTracking, type ChangedKey } from './sync/tracking'
import type { Trip } from '@/modules/trip/types'
import type { Accommodation } from '@/modules/accommodation/types'
import type { Activity } from '@/modules/activity/types'
import type { TravelLeg } from '@/modules/travel/types'
import type { PackingItem } from '@/modules/packing/types'
import type { Medication, Vaccination } from '@/modules/meds/types'
import type { EmergencyContact, TravelDocument } from '@/modules/documents/types'
import type { WeatherCache } from '@/modules/dayplanner/types'
import type { JournalEntry, Photo } from '@/modules/journal/types'
import type { WebsiteSettings } from '@/modules/website/types'
import type { Expense } from '@/modules/expenses/types'
import type { MapPlace } from '@/modules/map/types'
import type { PiwigoAlbumLink, PiwigoUpload } from '@/modules/piwigo/types'
import type { Route } from '@/modules/routes/types'
import type { OfflineMap } from '@/modules/map/offline'
import type { CountryInfo } from '@/modules/reiseinfo/types'

/**
 * Lokale Datenbank (IndexedDB) – die einzige Stelle, an der das Schema steht.
 *
 * Regeln für Änderungen:
 *  - Bestehende `version(n)`-Aufrufe NIE ändern.
 *  - Neue Tabellen oder Indizes => neue `version(n + 1)` darunter anlegen,
 *    bei Bedarf mit `.upgrade(tx => ...)` für die Datenmigration.
 *  - Neue Tabelle auch in `BACKUP_TABLES` (core/backup.ts) eintragen.
 */
export class NixDb extends Dexie {
  trips!: Table<Trip, string>
  accommodations!: Table<Accommodation, string>
  activities!: Table<Activity, string>
  travelLegs!: Table<TravelLeg, string>
  packingItems!: Table<PackingItem, string>
  medications!: Table<Medication, string>
  vaccinations!: Table<Vaccination, string>
  documents!: Table<TravelDocument, string>
  emergencyContacts!: Table<EmergencyContact, string>
  weather!: Table<WeatherCache, string>
  journalEntries!: Table<JournalEntry, string>
  photos!: Table<Photo, string>
  websites!: Table<WebsiteSettings, string>
  expenses!: Table<Expense, string>
  places!: Table<MapPlace, string>
  piwigoAlbums!: Table<PiwigoAlbumLink, string>
  routes!: Table<Route, string>
  countryInfos!: Table<CountryInfo, string>
  /** Nur auf diesem Gerät: gespeicherte Offline-Karten (große Dateien, werden nicht abgeglichen) */
  offlineMaps!: Table<OfflineMap, string>
  /** Nur auf diesem Gerät: Originalfotos, die noch nach Piwigo müssen */
  piwigoUploads!: Table<PiwigoUpload, string>
  /** Lokale Änderungen, die noch zum Server müssen */
  outbox!: Table<OutboxEntry, string>
  /** Interne Einstellungen (z. B. Abgleich) */
  meta!: Table<MetaEntry, string>

  constructor() {
    super('nix-wie-weg')

    // v1: Modul "Reiseprojekt"
    this.version(1).stores({
      trips: 'id, startDate, updatedAt'
    })

    // v2: Module "Unterkünfte" und "Unternehmungen"
    this.version(2).stores({
      accommodations: 'id, tripId, checkIn',
      activities: 'id, tripId, status, priority'
    })

    // v3: Modul "Anreise"
    this.version(3).stores({
      travelLegs: 'id, tripId'
    })

    // v4: Modul "Packliste"
    this.version(4).stores({
      packingItems: 'id, tripId'
    })

    // v5: Modul "Reiseapotheke"
    this.version(5).stores({
      medications: 'id, tripId',
      vaccinations: 'id, tripId'
    })

    // v6: Modul "Dokumente & Notfall"
    this.version(6).stores({
      documents: 'id, tripId',
      emergencyContacts: 'id, tripId'
    })

    // v7: Teilnehmer pro Reise (kein neuer Index, nur Datenmigration)
    this.version(7)
      .stores({})
      .upgrade((tx) =>
        tx
          .table('trips')
          .toCollection()
          .modify((t: { participants?: string[] }) => {
            if (!Array.isArray(t.participants)) t.participants = []
          })
      )

    // v8: Tagesplaner – zuletzt geladene Wettervorhersage je Reise (nicht im Backup, wird neu geladen)
    this.version(8).stores({
      weather: 'tripId'
    })

    // v9: Reisetagebuch mit Fotos (Fotos als Blob, verkleinert)
    this.version(9).stores({
      journalEntries: 'id, tripId, date',
      photos: 'id, tripId, entryId'
    })

    // v10: Reise-Webseite – Einstellungen je Reise
    this.version(10).stores({
      websites: 'tripId'
    })

    // v11: Ausgaben unterwegs
    this.version(11).stores({
      expenses: 'id, tripId, date'
    })

    // v12: Karte – Positionen von Unterkünften und Unternehmungen
    this.version(12).stores({
      places: 'id, tripId'
    })

    // v13: Geräte-Abgleich – Änderungsprotokoll und interne Einstellungen
    this.version(13).stores({
      outbox: 'key',
      meta: 'key'
    })

    // v14: Piwigo – Album je Reise (abgeglichen) und Warteschlange zum Hochladen (nur lokal)
    this.version(14).stores({
      piwigoAlbums: 'id, tripId',
      piwigoUploads: 'id, tripId, photoId'
    })

    // v15: Routen (GPX, FIT, KML …)
    this.version(15).stores({
      routes: 'id, tripId, date'
    })

    // v16: Offline-Karten (nur auf diesem Gerät)
    this.version(16).stores({
      offlineMaps: 'id, tripId'
    })

    // v17: Reise- und Sicherheitshinweise je Zielland (Auswärtiges Amt)
    this.version(17).stores({
      countryInfos: 'id, tripId'
    })

    // Nächste Änderung: this.version(18).stores({ … })

    // Jede lokale Änderung in Nutzertabellen für den Abgleich vormerken
    this.use(changeTracking(DATA_TABLES, queueOutbox))
  }
}

/** Eintrag im Änderungsprotokoll: Datensatz `id` in Tabelle `tbl` wurde zuletzt um `at` geändert. */
export interface OutboxEntry {
  key: string
  tbl: string
  id: string
  at: string
}

export interface MetaEntry {
  key: string
  value: unknown
}

export const outboxKey = (tbl: string, id: string) => `${tbl}\u0001${id}`

const outboxListeners = new Set<() => void>()

/** Wird nach jeder vorgemerkten lokalen Änderung aufgerufen (z. B. um bald abzugleichen). */
export function onLocalChange(fn: () => void): () => void {
  outboxListeners.add(fn)
  return () => outboxListeners.delete(fn)
}

function queueOutbox(keys: ChangedKey[]): void {
  const at = new Date().toISOString()
  // Eigene Transaktion nach der ursprünglichen Änderung
  setTimeout(() => {
    db.outbox
      .bulkPut(keys.map((k) => ({ key: outboxKey(k.tbl, k.id), tbl: k.tbl, id: k.id, at })))
      .then(() => outboxListeners.forEach((fn) => fn()))
      .catch((e) => console.error('[Abgleich] Änderung konnte nicht vorgemerkt werden', e))
  }, 0)
}

export const db = new NixDb()

/** Erzeugt eine eindeutige ID, auch offline. */
export function newId(): string {
  return crypto.randomUUID()
}

/** Zeitstempel im ISO-Format für createdAt/updatedAt. */
export function now(): string {
  return new Date().toISOString()
}
