# Architektur

## Grundsätze

1. **Offline zuerst.** Alle Daten liegen in IndexedDB auf dem Gerät. Online-Dienste (Wetter, Karten) ergänzen nur und werden zwischengespeichert.
2. **Module kennen einander nicht.** Jedes Modul meldet sich über `core/registry.ts` an und nutzt nur den Kern. Verknüpfung läuft über IDs (z. B. `tripId`).
3. **Daten nur über Repositories.** Views greifen nie direkt auf `db` zu, sondern auf `<modul>/repository.ts`.
4. **Logik ohne Oberfläche.** Berechnungen und Prüfungen stehen in `<modul>/logic.ts` als reine Funktionen und haben Tests.
5. **Öffentliche Schnittstellen.** Module importieren voneinander nur die Datei `public.ts` (z. B. `trip/public.ts`, `activity/public.ts`), nie deren innere Dateien. Abhängigkeiten nur in eine Richtung: Basis-Module (Reise, Unternehmungen) kennen die Aufbau-Module (Tagesplaner) nicht.
6. **Andocken an die Reise-Seite** über `tripSection` (Titel, Link, Zusammenfassung, geplante Kosten) und Aufräumen über `onTripDelete` in der Modul-Definition.
7. **Bootstrap nicht verändern.** Anpassungen nur über CSS-Variablen in `src/ui/theme.css`.

## Schichten

```
Module (trip, packing, meds, dayplanner, journal, website …)
   │  nutzen nur
   ▼
Kern  (db.ts · registry.ts · router.ts · backup.ts · composables.ts · dates.ts · format.ts)
   │
   ├── Offline: Service Worker (App, Kartenkacheln, letztes Wetter)
   └── Online-Dienste über src/services/ (Open-Meteo, OpenStreetMap, OpenRouteService)
```

## Datenbank

- Schema steht ausschließlich in `src/core/db.ts`.
- Schemaänderung = neue `version(n + 1)`, alte Versionen bleiben unverändert.
- Jede neue Tabelle auch in `BACKUP_TABLES` (`src/core/backup.ts`) eintragen.
- IDs sind UUIDs (`newId()`), damit später eine Synchronisation zwischen Geräten möglich ist.
- Jeder Datensatz hat `createdAt` und `updatedAt`.

## Reise-Webseite (M5)

Der Generator (`modules/website`) erzeugt **eine einzige HTML-Datei**: Bootstrap-CSS, Vorlagen-CSS, Texte und alle Fotos (als data:-URL, auf die gewählte Größe verkleinert) sind eingebettet, dazu ein kleines Skript für die Fotoansicht. Die Datei funktioniert ohne Internet und lässt sich teilen oder auf GitHub Pages hochladen.

- `logic.ts`: Daten aufbereiten (`buildSiteData`), sicheres HTML (`esc`, `paragraphs`)
- `templates/<name>.ts`: eine Vorlage = CSS + Funktion, die den `<body>` liefert; Registrierung in `templates/index.ts`, Beschreibung in `TEMPLATE_INFO`
- `render.ts`: setzt das Dokument zusammen (Kopf, Farben, Schrift, Hell/Dunkel, Fotoansicht)
- Alle Nutzertexte laufen durch `esc()`, Farben durch `safeColor()`.

## Automatischer Abgleich (eigener Server)

- **Server** (`server/server.mjs`): speichert pro Reisegruppe (Schlüssel) Datensätze `(tbl, id, stamp, deleted, data)` mit fortlaufender Nummer `seq`; Fotos als Dateien nach SHA-256. Neuere gewinnt (`stamp`).
- **Änderungsprotokoll** (`core/sync/tracking.ts`): Dexie-Middleware merkt jede lokale Änderung in den Tabellen aus `core/tables.ts` in `outbox` vor – auch Löschungen. Module müssen dafür nichts tun.
- **Ablauf** (`core/sync/engine.ts`): erst `outbox` hochladen (Fotos vorher einzeln), dann alle Änderungen seit `lastSeq` abholen und anwenden (`applyAction` in `core/sync/logic.ts`). Vom Server übernommene Änderungen werden nicht erneut vorgemerkt.
- **Auslöser:** App-Start, wieder online, zurück in die App, 4 s nach einer Änderung, alle 5 Minuten.
- **Regel für Module:** Jede Änderung setzt `updatedAt` (bzw. `createdAt` beim Anlegen) – sonst gilt sie nicht als neuer.

## Piwigo (Fotogalerie)

- **Brücke im Abgleich-Server** (`server/piwigo.mjs`): Der Server meldet sich mit einem Piwigo-API-Schlüssel an (`pwg.session.login` mit Schlüssel-ID und Geheimnis) und bietet unter `/api/piwigo/…` Alben, Fotos und Hochladen an. Die App braucht so weder CORS noch Cookies bei Piwigo, und der Schlüssel bleibt auf dem Server.
- **Modul** `modules/piwigo`: Fotoquelle „Aus Piwigo“ im Tagebuch (`photoSource`), Warteschlange `piwigoUploads` (nur lokal, enthält Originale) und Album je Reise `piwigoAlbums` (abgeglichen).
- Ein hochgeladenes oder übernommenes Foto bekommt `externalRef = "piwigo:<id>"` und `externalUrl`. Solche Fotos werden nicht erneut hochgeladen.
- Doppelte Uploads verhindert der Server über die MD5-Prüfsumme (`pwg.images.exist`).

## Reisegruppen und Lese-Links

- **Server in Modulen** (`server/`): `store.mjs` (SQLite, Fotos), `groups.mjs` (Schlüssel → Gruppe), `shares.mjs` (Lese-Links), `static.mjs` (App ausliefern), `piwigo.mjs`, `http.mjs`; `server.mjs` setzt alles zusammen.
- **Gruppen:** Jeder Schlüssel ergibt einen getrennten Datenbereich (`space`). Der erste Schlüssel in `NWW_KEYS` ist der Besitzer (Gruppen verwalten, Piwigo). Weitere Gruppen legt er in der App an; gespeichert wird nur die SHA-256-Prüfsumme des Schlüssels.
- **Lese-Links:** Zufallscode (128 Bit) je Link, Daten liegen in `shares`. Öffentlich (`/api/public/<code>`) gibt der Server **nur** Reise-Eckdaten, Tagebucheinträge (alle oder Highlights) und deren Fotos heraus – Positivliste, nie ganze Datensätze. Passwort: scrypt; Fotos dann nur mit kurzlebigem HMAC-Ticket.
- **Betrachter-Seite** `share.html` (zweiter Einstieg im Vite-Build) nutzt die Vorlagen und Schriften der Reise-Webseite (`modules/website/public.ts`).

## Routen

- `modules/routes/parse/`: Leser für GPX, TCX, KML (eigene kleine XML-Hilfen ohne DOM, laufen auch in Tests), KMZ (ZIP + `DecompressionStream`), GeoJSON und FIT (Binärformat von Garmin, nur Nachrichten `file_id`, `record`, `course`).
- Gespeichert werden vereinfachte Punkte (`points` ≤ 2000, `preview` ≤ 400) plus Kennzahlen aus **allen** Punkten; die Originaldatei als Anhang (wird wie Fotos abgeglichen).
- Lese-Links bekommen nur `preview` (≤ 600 Punkte), Name, Farbe, Tag und Kennzahlen – keine Notizen, keine Originaldatei.

## Push-Benachrichtigungen (Web Push)

- **Server** (`server/benachrichtigungen.mjs`, ohne Pakete): VAPID-Schlüssel (RFC 8292) einmal erzeugt in `settings`, Verschlüsselung `aes128gcm` (RFC 8291) mit `node:crypto`, geprüft gegen das Beispiel aus dem RFC. Tabellen `push_subs` (Abo je Gerät, Einstellungen `erinnerungen`/`aenderungen`) und `push_schedule` (Zeitplan je Person `space:member`, gesendete bleiben 3 Tage stehen → nichts doppelt). Takt jede Minute. Nur an bekannte Push-Dienste (`PUSH_HOSTS`), kein Weiterleiten ins Heimnetz.
- **Erinnerungen:** Der Server kennt die Termine nicht (Module rechnen sie in der App aus). `pushItems` (`core/reminders.ts`) macht aus den Terminen Zeitpunkte – Beginn minus `defaultAlarm`, in der Zeitzone des Geräts; das Modul Termine (`push-zeitplan.ts`) lädt sie nach jedem Abgleich hoch, wenn die Person irgendwo Erinnerungen eingeschaltet hat (`geraete` > 0).
- **Neues von Mitreisenden:** `/api/push` meldet übernommene Änderungen an `noteChanges`; je Gerät und Reise gesammelt (3 min), höchstens alle 15 min, nur Sichtbares (`accessFor`), nie an die Person, die geändert hat. Bündel liegen nur im Speicher.
- **App:** `core/push.ts` (Abo beim Browser, Anmelden beim Server, `startPush` hält es aktuell), `core/views/PushSettings.vue` (`/benachrichtigungen`). Der Service Worker bleibt von Workbox erzeugt; `public/push-sw.js` kommt per `importScripts` dazu (Anzeigen, Antippen → `postMessage` an die offene App bzw. App öffnen).
- iOS: nur als installierte App (Home-Bildschirm, ab 16.4), `requestPermission` direkt im Klick.

## Unwetterwarnungen (MeteoAlarm)

- **Server** (`server/unwetter.mjs`, ohne Pakete): Atom-Feed je Land (`FEEDS`, 10 min zwischengespeichert), Ort → Warnregion (EMMA_ID) über die vereinfachten Umrisse in `server/daten/meteoalarm-regionen.json.gz` (Punkt-in-Fläche, Gerade-Ungerade-Regel), unbekannte Regionen über den Namen. Text aus der CAP-Nachricht (nur gleiche Herkunft wie der Feed). `GET /api/unwetter?orte=…&laender=…`.
- **Push:** Die App lädt die Orte der laufenden/kommenden Reisen hoch (`PUT /api/unwetter/beobachten`, je Person, wie der Zeitplan der Erinnerungen); der Server prüft alle 10 min und merkt sich Gesendetes in `unwetter_sent` (Art + Stufe + Tag + Regionen → Aktualisierungen derselben Warnung kommen nicht doppelt). Einstellungen `unwetter`/`unwetterGelb` am Push-Abo.
- **App** (`modules/unwetter`): Orte aus Unterkünften mit Kartenpunkt, Wetter-Ort des Tagesplans, sonst das per Ortssuche gefundene Reiseziel (`reiseOrte` in `logic.ts`). Warnungen nur als Zwischenspeicher auf dem Gerät (Tabelle `unwetter`, nicht abgeglichen). Hinweis im Tagesplan über `UnwetterHinweis` aus `unwetter/public.ts`.

## Abgleich per Datei (ohne Server)

Ohne Server: `exportTrip()` (core/backup.ts) schreibt eine Reise mit allen zugehörigen Datensätzen (alle Tabellen mit `tripId`) in eine JSON-Datei. `importBackup()` führt zusammen: neue Datensätze werden ergänzt, vorhandene nur ersetzt, wenn `updatedAt` neuer ist (Logik in `core/merge.ts`). Löschungen werden nicht übertragen. Daher: **jeder Datensatz braucht `updatedAt`** (bzw. `createdAt`), und jede Änderung muss es setzen.

## Konfiguration

`src/config.ts` enthält App-Name, Repository- und Spendenlink. Die Versionsnummer kommt beim Bauen aus `package.json` (`__APP_VERSION__`).

## Entscheidungen

| Datum | Entscheidung | Grund |
| --- | --- | --- |
| 2026-10-03 | PWA statt nativer App | eine Codebasis, offline-fähig, später per Capacitor in die Stores |
| 2026-10-03 | Vue 3 + Bootstrap 5.3 | leicht lesbar, Bootstrap auch für Webseiten-Templates |
| 2026-10-03 | Dexie/IndexedDB | große Datenmengen (Fotos) lokal, Live-Abfragen |
| 2026-10-03 | Reise-Seite über `tripSection` erweiterbar | Reise-Modul muss neue Module nicht kennen |
| 2026-10-04 | Eigener Abgleich-Server ohne Fremdpakete, Fotos in voller Größe | volle Datenhoheit, geringe Pflege; Wunsch des Nutzers |
| 2026-10-04 | Abgleich per Datei, neuere Änderung gewinnt | kein Server, keine Konten, Datenschutz; einfach per AirDrop |
| 2026-10-12 | Routen-Leser selbst geschrieben (GPX/FIT/KML …) statt Bibliotheken | keine Abhängigkeit, offline, FIT direkt von Garmin-Geräten |
| 2026-10-12 | Strecken auf Webseite/Lese-Link als SVG ohne Kartenkacheln | eigenständige HTML-Datei bleibt offline nutzbar, keine Kachel-Nutzungsregeln |
| 2026-10-12 | Lese-Links + getrennte Reisegruppen statt Benutzerkonten | deckt „Freunde sehen, nicht ändern“ und „Freunde nutzen die App selbst“ ab – ohne Passwörter/Rechteverwaltung pflegen zu müssen |
| 2026-10-12 | Mitgelieferte Schriften (@fontsource, OFL) | sehen auf allen Geräten gleich aus, offline nutzbar, im Export eingebettet |
| 2026-10-11 | Piwigo über den Abgleich-Server statt direkt aus der App | Safari blockiert Cookies fremder Seiten; Schlüssel bleibt auf dem Server; Piwigo muss nicht öffentlich sein |
| 2026-10-11 | Tagebuch behält verkleinerte Kopie (2048 px), Original nach Piwigo | offline nutzbar, volle Qualität in der Galerie; Wunsch des Nutzers |
| 2026-10-14 | Push-Benachrichtigungen über den eigenen Server (Web Push, VAPID ohne Pakete), Zeitplan von der App | Erinnerungen auch bei geschlossener App; Termine entstehen in den Modulen, der Server bleibt dumm; keine Fremddienste außer dem Push-Dienst des Geräts |
| 2026-10-14 | Unwetterwarnungen über MeteoAlarm und den eigenen Server, Regionen-Umrisse mitgeliefert | amtliche Warnungen für ganz Europa aus einer Quelle; Zuordnung per Koordinaten statt Namen; Push ohne offene App |
| 2026-10-03 | Teilnehmer als Namensliste an der Reise (`participants`), Module speichern den Namen im Feld `person` | einfach, offline, ohne eigene Personen-Tabelle; `PersonSelect` aus `trip/public` für alle Formulare |
