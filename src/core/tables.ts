/**
 * Tabellen mit Nutzerdaten – werden gesichert (Backup) und zwischen Geräten abgeglichen.
 * Neue Tabelle mit Nutzerdaten: hier eintragen (und in db.ts anlegen).
 * Nicht hier: reine Zwischenspeicher (weather), interne Tabellen (outbox, meta) und
 * gerätebezogene Warteschlangen (piwigoUploads).
 */
export const DATA_TABLES = [
  'trips',
  'accommodations',
  'activities',
  'travelLegs',
  'packingItems',
  'medications',
  'vaccinations',
  'documents',
  'emergencyContacts',
  'journalEntries',
  'websites',
  'expenses',
  'places',
  'piwigoAlbums',
  'routes',
  'photos'
] as const
