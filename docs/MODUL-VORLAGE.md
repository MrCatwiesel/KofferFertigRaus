# Vorlage: neues Modul anlegen

Beispiel: Modul **Packliste** mit der ID `packing`.

## 1. Ordner anlegen

```
src/modules/packing/
  index.ts          Modul-Definition (Name, Icon, Routen)
  types.ts          Datentypen
  logic.ts          reine Funktionen (ohne Datenbank, ohne Vue)
  repository.ts     Datenzugriff
  views/            Seiten (.vue)
  __tests__/        Tests für logic.ts
```

## 2. Tabelle in der Datenbank ergänzen

In `src/core/db.ts` eine **neue** Version anlegen – bestehende nie ändern:

```ts
packingItems!: Table<PackingItem, string>

this.version(2).stores({
  packingItems: 'id, tripId, category, done'
})
```

Danach `'packingItems'` in `BACKUP_TABLES` (`src/core/backup.ts`) eintragen.

## 3. Modul-Definition

```ts
// src/modules/packing/index.ts
import type { AppModule } from '@/core/registry'

export const packingModule: AppModule = {
  id: 'packing',
  title: 'Packliste',
  icon: 'backpack',
  order: 20,
  routes: [
    { path: '/trip/:tripId/packliste', component: () => import('./views/PackingList.vue'), props: true }
  ]
}
```

Module, die zu einer Reise gehören, brauchen kein `navTo`. Stattdessen erscheinen sie über `tripSection` auf der Reise-Detailseite, und `onTripDelete` räumt ihre Daten auf, wenn die Reise gelöscht wird:

```ts
  tripSection: {
    title: 'Packliste',
    icon: 'backpack',
    to: (tripId) => `/trip/${tripId}/packliste`,
    summary: async (tripId) => `${await countOpen(tripId)} Sachen offen`
  },
  onTripDelete: (tripId) => packingRepository.removeByTrip(tripId)
```

Weitere Andockpunkte (Beispiel: `src/modules/piwigo/index.ts`):

| Feld | Zweck |
| --- | --- |
| `photoSource` | zusätzliche Fotoquelle im Tagebuch (Knopf neben „Fotos hinzufügen“); Komponente meldet `picked` mit `PickedPhoto[]` |
| `onPhotosAdded` | neue eigene Fotos wurden gespeichert – mit Originaldatei (z. B. zum Hochladen) |
| `onStart` | einmal nach dem App-Start (Hintergrund-Aufgaben) |

Vollständige Beispiele: `src/modules/accommodation/index.ts` und `src/modules/activity/index.ts`. Für die Kopfzeile von Unterseiten `TripContextHeader` aus `@/modules/trip/public` verwenden.

## Daten anderer Module nutzen

Nur über deren `public.ts` importieren (z. B. `@/modules/activity/public`). Braucht ein Modul etwas, das noch nicht öffentlich ist, wird es dort ergänzt – nie direkt aus `repository.ts` oder `types.ts` eines anderen Moduls importieren.

Jeder Datensatz braucht `createdAt` und `updatedAt`, und jede Änderung setzt `updatedAt` neu – sonst funktioniert der Abgleich zwischen Geräten nicht.

## 4. Registrieren

In `src/modules/index.ts`:

```ts
import { packingModule } from './packing'
registerModule(packingModule)
```

## 5. Fertig, wenn

- [ ] `npm test` grün, Logik hat Tests
- [ ] funktioniert im Flugmodus
- [ ] Daten erscheinen im Backup-Export
- [ ] Eintrag in `CHANGELOG.md`
