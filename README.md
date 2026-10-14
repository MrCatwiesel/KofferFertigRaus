# Nix wie weg

Reise-App von der Planung bis zur Reise-Webseite – offline zuerst, als installierbare Web-App (PWA) für Handy, Tablet und PC.

**Stand 1.5.0 – alle Meilensteine umgesetzt:**

- **Planen:** Reiseprojekt mit Teilnehmern, An- und Rückreise, Unterkünfte, Unternehmungen, Budget, gemeinsame Abstimmungen
- **Vorbereiten:** Packliste (Vorlagen, pro Person), Reiseapotheke, Dokumente & Notfallnummern
- **Unterwegs:** Tagesplaner mit Wetter, Unwetterwarnungen und Öffnungszeiten, Karte, Ausgaben mit Ausgleich, Routen & Touren (GPX, Garmin FIT, KML) mit Höhenprofil
- **Erinnern & teilen:** Reisetagebuch mit Fotos, Reise-Webseite als eine HTML-Datei, Anbindung an die eigene **Piwigo**-Galerie
- **Zusammen reisen:** alle Geräte automatisch abgleichen über einen eigenen kleinen Server (`server/`), oder ohne Server per Datei
- **Mit Freunden teilen:** Lese-Links je Reise (nur Highlights oder ganzes Tagebuch), eigene Reisegruppen für Freunde
- **Hilfe eingebaut:** „?“ auf jeder Seite, Suche, kurze Einführung beim ersten Start
- **Deutsch und Englisch** (automatisch nach Gerät, umschaltbar in den Einstellungen)

**App online:** https://mrcatwiesel.github.io/nix-wie-weg-/

## Starten

Voraussetzung: [Node.js](https://nodejs.org) 20 oder neuer.

```bash
npm install      # einmalig: Abhängigkeiten laden
npm run dev      # Entwicklungsserver, im Browser http://localhost:5173 öffnen
npm test         # Tests ausführen
npm run build    # fertige App in dist/ (statisch hostbar, z. B. GitHub Pages)
npm run e2e      # Klicktests im Browser (vorher build; einmalig: npx playwright install chromium)
```

Auf dem Handy testen: `npm run dev -- --host` und die angezeigte Netzwerk-Adresse im Handy-Browser öffnen (gleiches WLAN). Offline und „Zum Startbildschirm hinzufügen“ funktionieren im Build (`npm run build && npm run preview -- --host`).

## Auf dem iPad oder einem einfachen Webserver

Die App braucht **keinen Datenbank-Server**: alle Daten liegen im Browser (IndexedDB). Der Server liefert nur die fertigen Dateien aus dem Ordner `dist/` aus.

**Weg A – ganz ohne Computer (GitHub):**
1. Auf github.com ein neues Repository anlegen und den Projektinhalt hochladen („Add file → Upload files“).
2. Settings → Pages → Source: **GitHub Actions** wählen.
3. Unter „Actions“ baut GitHub die App automatisch. Danach:
   - online nutzbar unter `https://<name>.github.io/<repository>/`, oder
   - im Lauf unter „Artifacts“ **nix-wie-weg-app** herunterladen, entpacken und den Inhalt in den Ordner des Tiny-Servers kopieren.

**Weg B – mit einem Computer:** `npm install && npm run build`, dann den Inhalt von `dist/` auf das iPad in den Server-Ordner kopieren.

Wichtig:
- Öffnen in Safari auf demselben iPad über `http://localhost:<port>/` (nicht über die IP-Adresse) – nur dann funktionieren Offline-Modus und „Zum Home-Bildschirm“.
- Die Daten gehören zur Adresse: unter einer anderen Adresse oder einem anderen Port beginnt die App leer. Umzug über Einstellungen → Backup.
- Die Datei `index.html` direkt aus der Dateien-App zu öffnen funktioniert nicht; es braucht den Webserver.

## Technik

| Baustein | Wahl |
| --- | --- |
| Oberfläche | Vue 3 + TypeScript, Vite |
| Design | Bootstrap 5.3 + Bootstrap Icons, Theme über CSS-Variablen (`src/ui/theme.css`) |
| Daten | IndexedDB über Dexie, nur auf dem Gerät |
| Offline | Service Worker über vite-plugin-pwa |
| Tests | Vitest |

## Projektstruktur

```
src/
  core/            Kern: Datenbank, Modul-Registry, Router, Backup, Einstellungen, Hilfe (hilfe/inhalt.ts)
  ui/              gemeinsames Theme und (später) gemeinsame Komponenten
  modules/
    index.ts       Liste der aktiven Module
    trip/          Modul "Reiseprojekt" (public.ts = Schnittstelle für andere Module)
    travel/        Modul "Anreise"
    accommodation/ Modul "Unterkünfte"
    packing/       Modul "Packliste" (templates.ts = Vorlagen)
    meds/          Modul "Reiseapotheke" (Medikamente, Einnahmeplan, Impfungen)
    documents/     Modul "Dokumente & Notfall"
    dayplanner/    Modul "Tagesplaner" (Wetter, Vorschläge, „Heute“)
    journal/       Modul "Reisetagebuch" (Einträge, Fotos, Highlights)
    expenses/      Modul "Ausgaben" (Budget, Ausgleich)
    map/           Modul "Karte" (Leaflet, OpenStreetMap)
    routes/        Modul "Routen & Touren" (parse/ = GPX, FIT, TCX, KML/KMZ, GeoJSON)
    website/       Modul "Reise-Webseite" (templates/ = Design-Vorlagen, render.ts = HTML-Datei)
    activity/      Modul "Unternehmungen"
    abstimmung/    Modul "Abstimmungen" (eine Stimme je Person als eigener Datensatz)
    piwigo/        Modul "Piwigo" (Fotos hochladen und auswählen, über den Abgleich-Server)
    share/         Modul "Lese-Links" (Reisen für Freunde freigeben)
    unwetter/      Modul "Unwetterwarnungen" (MeteoAlarm über den eigenen Server, auch als Push)
  share/           Betrachter-Seite für Lese-Links (share.html)
  services/        weather.ts (Open-Meteo), geocoding.ts (Nominatim), openingHours.ts, images.ts, tracks.ts (Strecken zeichnen)
  config.ts        App-Einstellungen (Spendenlink, Repository)
server/            Abgleich-Server (Node.js ohne Pakete, Docker, Anleitung in server/README.md)
docs/
  ARCHITEKTUR.md   Regeln und Aufbau
  MODUL-VORLAGE.md So entsteht ein neues Modul
```

## Weiterentwickeln

- Neues Modul: siehe [docs/MODUL-VORLAGE.md](docs/MODUL-VORLAGE.md)
- Architektur-Regeln: siehe [docs/ARCHITEKTUR.md](docs/ARCHITEKTUR.md)
- Änderungen: [CHANGELOG.md](CHANGELOG.md)

## Roadmap

| Meilenstein | Inhalt | Status |
| --- | --- | --- |
| M0 Fundament | Gerüst, Kern, Datenbank, PWA, Theme | erledigt |
| M1 Planung | Reiseprojekt, Anreise, Unterkünfte, Unternehmungen, Budgetvergleich | erledigt |
| M2 Vorbereitung | Packliste, Reiseapotheke, Dokumente & Notfall | erledigt |
| M3 Unterwegs | Tagesplaner, Wetter, Öffnungszeiten, Karte, Ausgaben | erledigt |
| M4 Tagebuch | Einträge, Fotos, Highlights | erledigt |
| M5 Webseite | 3 Vorlagen, Farbe/Schrift/Dunkel, Highlights, Export als eine HTML-Datei, Teilen | erledigt |
| M6 Ausbau | Abgleich zwischen Geräten, Spenden-Bereich | erledigt (App-Store-Version optional, siehe unten) |

## Geräte-Abgleich (eigener Server)

Damit Handys, Tablet und PC automatisch dieselben Daten haben: Server nach [server/README.md](server/README.md) einrichten
(Proxmox zu Hause: [server/proxmox/README.md](server/proxmox/README.md)),
dann in der App *Einstellungen → Geräte-Abgleich*.
Dort lassen sich auch **Push-Benachrichtigungen** einschalten (Erinnerungen an Fristen und Termine, Neues von den Mitreisenden, Unwetterwarnungen).
Über den Server kommen auch die **Unwetterwarnungen** (MeteoAlarm) für die Orte einer Reise.

## Spenden einrichten

Die App ist kostenlos und ohne Werbung. Wer die Entwicklung unterstützen möchte: [PayPal](https://www.paypal.me/MrCatwiesel).

Für eigene Fassungen: In `src/config.ts` bei `donationUrl` den Link eintragen. Ist das Feld leer, erscheinen keine Spenden-Hinweise.

## App Store (optional)

Die App ist eine PWA und lässt sich über „Teilen → Zum Home-Bildschirm“ wie eine App installieren. Eine Version im App Store wäre mit Capacitor möglich, braucht aber einen Mac mit Xcode und ein Apple-Entwicklerkonto (99 $/Jahr).

## Lizenz

**GNU Affero General Public License v3.0** (AGPL-3.0, siehe [LICENSE](LICENSE)).

Kurz gesagt: Jeder darf „Nix wie weg“ kostenlos nutzen, verändern und weitergeben – auch selbst betreiben.
Wer eine **veränderte** Version weitergibt oder für andere als Dienst im Netz betreibt, muss deren Quellcode
ebenfalls unter der AGPL offenlegen. So bleibt die App frei und niemand kann daraus ein geschlossenes Produkt machen.
