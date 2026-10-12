# Änderungsprotokoll

## 1.5.1 – 2026-10-12

### Behoben
- **Verorten auf der Karte:** Routen (z. B. importierte GPX) lassen sich jetzt antippen – im Modus „Auf der Karte antippen“ wird der nächste Punkt der Route übernommen. Die Linie hat dafür eine breite, unsichtbare Tippfläche (für Finger auf dem iPad/Handy).

### Neu
- **GPS-Koordinaten eingeben** im Suchfeld beim Verorten – ohne Internet: Dezimalgrad (`47.0751, 12.7530`, auch mit Komma), Garmin-Anzeige (`N 47° 04.507' E 012° 45.180'`), Grad/Minuten/Sekunden sowie geteilte Links aus Google Maps und Apple Karten (`services/coordinates.ts`)
- Steht im Ort einer Unternehmung schon eine Koordinate, wird sie beim Verorten direkt vorgeschlagen
- Beim Verorten: **Start oder Ziel einer Route übernehmen**
- Routen-Popup zeigt die Koordinate der angetippten Stelle und bietet „… hier setzen“
- Verortete Orte zeigen ihre Koordinaten (Garmin-Format); neu im Menü: **„Koordinaten kopieren“**

## 1.5.0 – 2026-10-12

### Neu
- **Routen & Touren** (Reise → „Routen & Touren“):
  - Import von **GPX, FIT (Garmin Fenix/GPSMap), TCX, KML/KMZ (Google My Maps) und GeoJSON** – eigene Leser ohne Fremddienste; eine Datei kann mehrere Routen enthalten
  - Karte mit Start/Ziel, **Höhenprofil**, Länge, Auf-/Abstieg (geglättet), Höhe min–max, Dauer
  - Zuordnung zu einem Reisetag (automatisch aus der Aufzeichnung), Farbe, Notizen
  - **Als GPX exportieren** (für Garmin Express/Basecamp/Connect) und Originaldatei wieder herunterladen
  - Große Aufzeichnungen werden für die Anzeige vereinfacht (Douglas-Peucker), das Original bleibt erhalten
- Routen erscheinen auf der **Reisekarte** (auch im Tagesfilter) und im **Tagebuch** unter ihrem Tag
- **Reise-Webseite und Lese-Links** zeigen freigegebene Routen als Strecke mit Höhenprofil (ohne Kartenkacheln, funktioniert offline); je Lese-Link „Routen zeigen“ ein/aus
- Neue Andockpunkte für Module: `mapOverlays`, `dayLinks`

### Geändert
- Datenbank-Version 15 (Tabelle `routes`, wird abgeglichen)
- Strecken zeichnen/beschreiben zentral in `services/tracks.ts`

## 1.4.0 – 2026-10-12

### Neu
- **Lese-Links für Freunde** (Reise → „Für Freunde freigeben“): eine Reise zum Ansehen freigeben – ohne App, ohne Schlüssel, ohne Änderungsrecht
  - je Link wählbar: **nur Highlights oder ganzes Tagebuch** (jederzeit umschaltbar), Fotos ja/nein, Überschrift, Notiz „für wen“
  - optional Passwort und Ablaufdatum; zurückziehen, wieder freigeben, löschen; Anzahl und Zeit der Aufrufe
  - Aussehen wie die Reise-Webseite oder eigenes (Vorlage, Schrift, Farbe, dunkel)
  - Nie enthalten: Planung, Budget, Ausgaben, Apotheke, Dokumente, Notfallnummern, Mitreisende – der Server gibt sie gar nicht heraus
  - Betrachter-Seite unter `/s/<code>` (eigene kleine Seite, nicht in Suchmaschinen)
- **Reisegruppen** (Einstellungen → Geräte-Abgleich → Reisegruppen, nur Besitzer): Freunden eine eigene, getrennte Gruppe mit eigenem Schlüssel geben, Einladungslink, sperren, umbenennen, löschen
- **Piwigo nur für freigegebene Gruppen** – standardmäßig nur für den Besitzer (erster Schlüssel in `NWW_KEYS`)
- **8 neue Schriften** für Reise-Webseite und Lese-Links (Lora, Playfair Display, Merriweather, Roboto Slab, Nunito, Montserrat, Raleway, Caveat) – im Export eingebettet, sehen überall gleich aus

### Geändert
- Abgleich-Server 1.3.0 in Module aufgeteilt (`store`, `groups`, `shares`, `static`, `http`, `piwigo`); Docker kopiert alle Module
- App: gemeinsamer Server-Zugriff `core/sync/client.ts`, gemeinsame Geräte-Einstellungen `core/meta.ts` (Doppelungen entfernt)
- Service Worker leitet Lese-Links und `/api/` nicht mehr auf die App-Startseite um

## 1.3.0 – 2026-10-12

### Neu
- **App selbst hosten:** Der Abgleich-Server liefert die App unter seiner eigenen Adresse aus (`NWW_APP_DIR`) – mit passenden Cache-Regeln für Service Worker und Bootstrap
- GitHub baut bei jeder Änderung `nix-wie-weg-app.zip` (Release „app“); `server/proxmox/update.sh` lädt sie, täglicher Timer `nix-wie-weg-update.timer`
- Geräte-Abgleich erkennt, wenn die App vom eigenen Server kommt, und trägt die Adresse schon ein

## 1.2.1 – 2026-10-11

### Neu
- `server/proxmox/create-ct.sh`: legt auf dem Proxmox-Host den Container für den Abgleich-Server an und richtet ihn ein

## 1.2.0 – 2026-10-11

### Neu
- **Piwigo-Anbindung** (eigene Fotogalerie, ab Piwigo 16.1):
  - Neue Fotos aus dem Tagebuch werden im Hintergrund als **Original** in ein Piwigo-Album der Reise hochgeladen. Das Album wird automatisch angelegt (privat) oder kann gewählt werden.
  - Im Tagebuch **„Aus Piwigo“**: vorhandene Fotos aus Piwigo-Alben auswählen und übernehmen
  - Offline: In der App bleibt eine verkleinerte Fassung. Uploads warten, bis wieder Netz da ist, mit wachsenden Pausen nach Fehlern.
  - Reise-Seite → **Fotos in Piwigo**: Album, automatisches Hochladen ein/aus, Warteschlange und Fehler
- Abgleich-Server 1.1.0: **Piwigo-Brücke** (`/api/piwigo/…`); Einstellungen `NWW_PIWIGO_URL`, `NWW_PIWIGO_KEY_ID`, `NWW_PIWIGO_SECRET`, `NWW_PIWIGO_PUBLIC_URL`
- Neue Andockpunkte für Module: `photoSource`, `onPhotosAdded`, `onStart`

### Geändert
- Datenbank-Version 14 (Tabellen `piwigoAlbums`, `piwigoUploads`); Fotos haben `externalRef`/`externalUrl`

## 1.1.1 – 2026-10-11

### Neu
- **Proxmox-Einrichtung** (`server/proxmox/`): Installationsskript für einen Debian-LXC-Container ohne Docker
  - nur Abgleich-Server (hinter vorhandenem Reverse-Proxy) oder mit `--web <domain>` zusätzlich nginx, App und HTTPS (Let's Encrypt)
  - systemd-Dienst mit eigenem unprivilegiertem Benutzer, nginx-Konfiguration mit passenden Cache-Regeln für Bootstrap und Service Worker
- Server: Einstellung `NWW_HOST` (Bind-Adresse)

## 1.1.0 – 2026-10-04

### Neu
- **Automatischer Geräte-Abgleich** über einen eigenen Server: alle Geräte (Handys, Tablet, PC) haben dieselben Daten
  - Einstellungen → Geräte-Abgleich: Server-Adresse und Schlüssel, „Schlüssel erzeugen“, Verbindung testen
  - Weitere Geräte per **Kopplungs-Link** (AirDrop/Nachricht) verbinden
  - Abgleich beim Öffnen, nach Änderungen, wenn Internet zurückkommt und alle 5 Minuten; offline wird gesammelt
  - Neuere Änderung gewinnt, **Löschungen werden übertragen**, Fotos in voller Größe
  - Statusanzeige oben in der App (Wolke) mit Zahl wartender Änderungen
- **Abgleich-Server** (`server/`): Node.js ohne Fremdpakete, SQLite, Docker + Caddy (automatisches HTTPS), Anleitung für Mietserver und NAS

### Geändert
- Datenbank-Version 13 (Tabellen `outbox`, `meta`); Liste der Nutzertabellen zentral in `core/tables.ts`
- Bildunterschriften und Umsortieren von Etappen setzen jetzt `updatedAt`

## 1.0.1 – 2026-10-04

### Geändert
- Tagebuch: Einträge lassen sich direkt in der Übersicht über das ⋯-Menü löschen oder bearbeiten (mit Rückfrage, nennt die Zahl der Fotos)
- Alle Formulare: Löschen-Knopf zeigt jetzt den Text „Löschen“ statt nur eines Symbols

## 1.0.0 – 2026-10-04

Alle geplanten Meilensteine (M0–M6) sind umgesetzt.

### Neu
- **Ausgaben unterwegs:** Schnelleingabe („23,50 Pizza“), Kategorien, Fremdwährung mit Kurs, Belegfoto, Zahler und Aufteilung; Überblick mit Budgetanteil, Tagesdurchschnitt und Hochrechnung; Ausgleich „wer gibt wem wie viel“ mit möglichst wenigen Überweisungen
- **Karte:** OpenStreetMap mit Unterkünften und Unternehmungen; verorten per Adresssuche (Nominatim) oder Antippen; Tagesfilter; eigener Standort und „In deiner Nähe“; Route in Apple Karten/Google Maps; angesehene Kartenausschnitte bleiben offline verfügbar
- **Mit Mitreisenden teilen:** Reise als Datei verschicken (AirDrop, Nachricht) und auf dem anderen Gerät einlesen; neuere Änderungen gewinnen
- **Einlesen führt jetzt immer zusammen** (Backup und geteilte Reisen), mit Ergebnis „x neu, y aktualisiert“
- **Spenden-Bereich:** Link zentral in `src/config.ts`; Hinweis in den Einstellungen und nach dem Erstellen der Reise-Webseite (nur wenn ein Link eingetragen ist)
- Einstellungen: Über-Bereich mit Version, Quellcode-Link und Quellenangaben der Dienste

### Geändert
- Datenbank-Version 12 (neue Tabellen `expenses`, `places`), Backup enthält sie
- Versionsnummer kommt automatisch aus `package.json`
- Unterkünfte haben eine öffentliche Schnittstelle (`accommodation/public.ts`)

## 0.10.0 – 2026-10-04

### Neu
- Modul „Reise-Webseite“ (M5):
  - Drei Vorlagen: Klassisch (Titelbild, Tageskarten), Magazin (große Bilder, Reportage-Stil), Galerie (Fotoraster)
  - Anpassbar: Akzentfarbe, Schrift (Modern, Serif, Rund), Hell/Dunkel, Titel, Untertitel, Einleitung, Autor
  - Inhalt: nur Highlights oder alle Einträge, Stimmung und Orte ein-/ausblendbar, Bildgröße wählbar
  - Live-Vorschau, Einstellungen werden automatisch gespeichert
  - Export als eine einzige HTML-Datei mit allen Fotos (ohne Internet lesbar), Teilen über das iPad-Teilen-Menü, Herunterladen, Öffnen
  - Fotoansicht auf der Webseite (antippen, wischen per Klick links/rechts, Esc)
  - Anleitung zum Veröffentlichen auf GitHub Pages

### Geändert
- Datenbank-Version 10 (neue Tabelle `websites`), Backup enthält sie
- Tagebuch hat eine öffentliche Schnittstelle (`journal/public.ts`)

## 0.9.0 – 2026-10-04

### Neu
- Modul „Reisetagebuch“ (M4):
  - Einträge pro Tag mit Überschrift, Ort, Stimmung und Text; Zeitleiste über alle Reisetage, leere Tage mit „Eintrag schreiben“
  - Fotos aus Kamera oder Mediathek, mehrere auf einmal; werden auf max. 2048 px verkleinert (Hochformat wird richtig gedreht), mit Vorschaubild
  - Bildunterschriften, Reihenfolge ändern, erstes Foto = Titelbild
  - Vollbildansicht mit Wischen und Pfeiltasten
  - Highlights per Stern – Grundlage für die Reise-Webseite (M5)
- Einstellungen: Backup wahlweise mit Fotos; Speicheranzeige und „Dauerhaft speichern“ (schützt vor automatischem Löschen durch Safari)

### Geändert
- Datenbank-Version 9 (neue Tabellen `journalEntries`, `photos`)
- Backup kann Binärdaten (Fotos) einbetten

## 0.8.0 – 2026-10-04

### Neu
- Modul „Tagesplaner“ (M3):
  - Tagesleiste über die ganze Reise mit Wetter-Symbol, Temperatur und Anzahl geplanter Unternehmungen
  - Wettervorhersage über Open-Meteo (bis 16 Tage), Ort per Suche; wird gespeichert und ist offline sichtbar, automatische Aktualisierung nach 3 Stunden
  - Vorschläge je Tag aus den offenen Ideen: Priorität, Wetter (Regen → drinnen, Sonne → draußen), Öffnungszeiten, Tagesauslastung
  - Warnungen: Regen bei geplanter Draußen-Aktivität (mit Drinnen-Alternative zum Tauschen), an dem Tag geschlossen, über 8 Stunden Programm, Hitze
  - Einplanen, verschieben auf anderen Tag, zurück zu den Ideen, abhaken
- Neuer Menüpunkt „Heute“: springt direkt in den Tag der laufenden Reise
- Öffnungszeiten werden aus Freitext erkannt (z. B. „Di–So 10–18“, „Mo-Fr 9-12, 14-18; Sa 10-14“, „täglich“, „24/7“, OSM-Format)

### Geändert
- Datenbank-Version 8 (Tabelle `weather` als Zwischenspeicher)
- Unternehmungen haben eine öffentliche Schnittstelle (`activity/public.ts`)

## 0.7.0 – 2026-10-03

### Neu
- Teilnehmer pro Reise („Wer reist mit?“); die Personenzahl ergibt sich daraus
- Packliste getrennt pro Person:
  - Vorlagen legen Persönliches (Kleidung, Zahnbürste, Ladekabel, Schuhe …) je Teilnehmer an, Gemeinsames (Duschgel, Adapter, Zelt …) einmal
  - Auswahl, für wen Persönliches angelegt wird
  - Reiter „Alle“, je Person und „Gemeinsam“, jeweils mit eigenem Fortschritt und Warnung bei fehlenden wichtigen Dingen
  - Schnelleingabe ordnet neue Einträge der gewählten Person zu
- Reiseapotheke: Medikamente und Einnahmeplan nach Person filtern
- Dokumente: Vorschläge legen Ausweis, Versicherungskarte und Impfpass je Teilnehmer an
- „Für wen?“ in allen Formularen als Auswahl aus den Teilnehmern

### Geändert
- Datenbank-Version 7 (bestehende Reisen bekommen eine leere Teilnehmerliste)

## 0.6.0 – 2026-10-03

### Neu
- Modul „Dokumente & Notfall“ – Meilenstein M2 abgeschlossen
  - Dokumente mit Art, Person, Nummer (in der Übersicht teilweise verborgen), Gültigkeit, Status Fehlt/Beantragt/Vorhanden, Kopie abgelegt, eingepackt
  - Gültigkeitsprüfung: abgelaufen, endet vor Reiseende, Reisepass mit weniger als 6 Monaten Puffer
  - Dringender Hinweis, wenn Ausweis, Pass oder Visum innerhalb von 8 Wochen vor der Reise noch fehlen oder ungültig sind
  - Vorschläge passend zur Anreiseart (z. B. Führerschein und Fahrzeugschein beim Auto)
  - Notfallnummern: 112 (EU) und Sperr-Notruf immer sichtbar, eigene Nummern mit Anruf-Knopf

### Geändert
- Datenbank-Version 6 (neue Tabellen `documents`, `emergencyContacts`), Backup enthält sie

## 0.5.0 – 2026-10-03

### Neu
- Modul „Reiseapotheke“ mit drei Bereichen:
  - Medikamente: Dauermedikation, bei Bedarf, Notfall; Bedarf für Reisetage plus 3 Tage Reserve, Vorratsprüfung, Warnung bei Ablauf vor oder während der Reise; Rezept, Handgepäck, Kühlen; abhaken beim Packen
  - Einnahmeplan: alle Einnahmen eines Tages nach Uhrzeit, filterbar nach Person
  - Impfungen: Status Prüfen/Termin/Erledigt, Hinweis wenn Schutz vor Reiseende endet
- Grundausstattung Reiseapotheke mit einem Klick (ohne Dosierungen)

### Geändert
- Datenbank-Version 5 (neue Tabellen `medications`, `vaccinations`), Backup enthält sie

## 0.4.0 – 2026-10-03

### Neu
- Modul „Packliste“: abhaken mit Fortschrittsbalken, Kategorien zum Auf- und Zuklappen, Suche, Filter „nur offene“ und nach Person
- 9 Vorlagen (Grundausstattung, Strand, Wandern, Stadt, Winter, Camping, Kinder, Auto, Flug); Mengen nach Reisetagen und Personen, Doppeltes wird zusammengefasst
- Passende Vorlage zur Anreiseart wird vorausgewählt
- Packliste einer früheren Reise übernehmen
- Schnelleingabe mit Menge („3x Socken“), wichtige Dinge markieren und Warnung, wenn sie fehlen
- „Alle Häkchen entfernen“ zum Packen für die Rückreise

### Geändert
- Datenbank-Version 4 (neue Tabelle `packingItems`), Backup enthält sie

## 0.3.0 – 2026-10-03

### Neu
- Modul „An- und Rückreise“: Etappen mit Auto, Bahn, Flug, Bus, Fähre, Fahrrad; Fahrzeit (auch über Mitternacht), Kilometer, Kosten je Richtung
- Auto: Spritkosten-Rechner (Verbrauch × Preis) plus Maut/Vignette; Pausenempfehlung alle 2 Stunden
- Hinweis auf Lücken zwischen Etappen; Reihenfolge per Pfeil änderbar; Rückreise mit einem Klick aus der Hinreise erzeugen
- Route direkt in Apple Karten oder Google Maps öffnen
- Neue Etappen werden vorbelegt (Start = letztes Ziel, Datum, Verkehrsmittel, Verbrauch)
- Budgetvergleich enthält jetzt auch die Anreisekosten

### Geändert
- Datenbank-Version 3 (neue Tabelle `travelLegs`), Backup enthält sie

## 0.2.1 – 2026-10-03

### Geändert
- Läuft auf jedem einfachen Webserver und in jedem Unterordner (relative Pfade, Hash-Routing `#/trip`)
- GitHub Actions: automatischer Test, Build und Veröffentlichung auf GitHub Pages, fertige App als ZIP-Download
- Anleitung für iPad / Tiny-Server im README

## 0.2.0 – 2026-10-03

### Neu
- Modul „Unterkünfte“: Hotels, Ferienwohnungen, Camping erfassen; Status Idee/Angefragt/Gebucht/Storniert; Preis pro Nacht; Abdeckung der Reisenächte mit Lücken und Doppelbuchungen; Warnung vor ablaufenden kostenlosen Stornofristen
- Modul „Unternehmungen“: Ideen sammeln mit Kategorie, Drinnen/Draußen, Priorität, Dauer, Preis pro Person, Öffnungszeiten; Filter; Status inkl. „erledigt“ per Klick; Warnung bei über 8 Stunden Programm pro Tag
- Reise-Detailseite zeigt die Planungsbereiche der Module mit Zusammenfassung und vergleicht geplante Kosten mit dem Budget
- Kern: Module können Abschnitte auf der Reise-Seite beisteuern (`tripSection`) und beim Löschen einer Reise ihre Daten aufräumen (`onTripDelete`)
- Gemeinsame Hilfen `core/dates.ts` und `core/format.ts`

### Geändert
- Datenbank-Version 2 (neue Tabellen `accommodations`, `activities`), Backup enthält beide

## 0.1.0 – 2026-10-03

### Neu
- Projekt-Grundgerüst: Vue 3, TypeScript, Vite, Bootstrap 5.3, Bootstrap Icons
- PWA: installierbar, läuft offline (Service Worker)
- Kern: lokale Datenbank (Dexie/IndexedDB), Modul-Registry, Router, JSON-Backup (Export/Import)
- Modul „Reiseprojekt“: Reisen anlegen, bearbeiten, löschen; Zeitraum, Personen, Anreiseart, Budget pro Person und Tag
- Mobile Bedienung mit unterer Navigation, Dark Mode nach Systemeinstellung, Offline-Hinweis
- Tests für die Reise-Logik
