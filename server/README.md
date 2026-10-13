# Abgleich-Server für „Nix wie weg“

Damit alle Geräte (Handys, Tablet, PC) dieselben Daten haben, braucht es einen kleinen Server im Internet.
Er speichert die Reisedaten und Fotos eurer Reisegruppe und verteilt Änderungen an alle Geräte.

- **Keine Fremdpakete** – nur Node.js (ab 22.13), Datenbank ist SQLite (eingebaut)
- **Sicher**: Zugang nur mit eurem geheimen Schlüssel, HTTPS über Caddy (automatisches Zertifikat)
- **Wenig Pflege**: ein Docker-Befehl zum Starten, Daten in einem Docker-Volume

## Was du brauchst

1. Einen Rechner, der dauerhaft im Internet erreichbar ist, z. B.
   - einen **kleinen Mietserver** (VPS) mit Linux – meist ab ca. 4–5 € im Monat, 1 GB RAM reicht, oder
   - eine **NAS zu Hause** mit Docker (z. B. Synology „Container Manager“), erreichbar von außen.
2. Eine **(Sub-)Domain**, die auf diesen Rechner zeigt, z. B. `reise.deinname.de`.
   (Für zu Hause geht auch ein kostenloser DynDNS-Dienst.)
3. **Docker** mit Compose.

> Wichtig: Die App läuft über `https://`. Browser erlauben ihr deshalb nur Verbindungen zu Servern mit **https**.
> Die beiliegende Konfiguration kümmert sich darum (Caddy holt das Zertifikat automatisch).

> **Proxmox zu Hause (LXC, ohne Docker):** eigene Anleitung mit Installationsskript in [proxmox/README.md](proxmox/README.md).

## Einrichten (Mietserver mit Docker)

```bash
# 1. Dateien auf den Server holen
git clone https://github.com/MrCatwiesel/nix-wie-weg-.git
cd nix-wie-weg-/server

# 2. Einstellungen anlegen
cp .env.example .env
nano .env        # NWW_DOMAIN und NWW_KEYS eintragen (siehe unten)

# 3. Starten
docker compose up -d

# 4. Prüfen (sollte {"ok":true,...} zeigen)
curl https://reise.deinname.de/api/health
```

**Schlüssel:** In der App unter *Einstellungen → Geräte-Abgleich → „Schlüssel erzeugen“* einen Schlüssel erstellen,
kopieren und in `.env` bei `NWW_KEYS=` eintragen. Danach `docker compose up -d` erneut ausführen.

Mehrere Reisegruppen (z. B. Freunde) auf einem Server: Schlüssel mit Komma trennen.
Jede Gruppe sieht nur ihre eigenen Daten.

## Geräte verbinden

1. **Erstes Gerät:** App → Einstellungen → Geräte-Abgleich → Server-Adresse (`https://reise.deinname.de`) und Schlüssel eingeben → **Verbinden**.
2. **Weitere Geräte:** Auf dem ersten Gerät **„Kopplungs-Link teilen“** → per AirDrop/Nachricht an das andere Gerät → dort öffnen → **Verbinden**.

Vorhandene Daten auf allen Geräten werden beim ersten Verbinden zusammengeführt.

## NAS zu Hause (Synology)

- Im *Container Manager* ein Projekt aus diesem Ordner (`docker-compose.yml`) anlegen.
- Wenn die NAS schon über ihren eigenen Reverse-Proxy mit Zertifikat erreichbar ist, kannst du den Dienst `caddy`
  weglassen und stattdessen im DSM-Reverse-Proxy `https://reise.deinname.de` → `http://localhost:8787` eintragen
  (dazu beim Dienst `sync` den Port `8787:8787` freigeben).
- Router: Ports 80 und 443 an die NAS weiterleiten (bzw. was der Reverse-Proxy braucht).

## Piwigo anbinden (optional)

Wer seine Fotos in einer eigenen [Piwigo](https://piwigo.org)-Galerie hat (ab Version 16.1), kann sie mit der App verbinden:

- **Hochladen:** Neue Fotos aus dem Tagebuch landen als **Original** in einem Piwigo-Album der Reise. Das Album wird automatisch angelegt (privat) oder in der App gewählt.
- **Auswählen:** Im Tagebuch über **„Aus Piwigo“** vorhandene Fotos übernehmen.
- In der App bleibt eine verkleinerte Fassung (2048 px), damit das Tagebuch auch offline funktioniert.

Die App spricht dabei nie direkt mit Piwigo, sondern immer über diesen Server. Der Piwigo-Schlüssel bleibt deshalb auf dem Server, und Piwigo kann im Heimnetz bleiben.

**Einrichten:**

1. In Piwigo als **Administrator** anmelden → oben *Profil* → **API-Schlüssel** → neuen Schlüssel anlegen (z. B. „Nix wie weg“, Laufzeit 1 Jahr).
   Die **ID** (`pkid-…`) und das **Geheimnis** notieren. Das Geheimnis wird nur einmal angezeigt.
   (Die Profilseite gibt es nur mit dem Standard-Design der Galerie, nicht mit jedem Theme.)
2. In den Einstellungen des Servers eintragen, also in `.env` oder bei Proxmox in `/etc/nix-wie-weg/sync.env`:
   ```
   NWW_PIWIGO_URL=http://192.168.5.40          # Piwigo im Heimnetz (mit Unterordner, falls vorhanden)
   NWW_PIWIGO_KEY_ID=pkid-20261011-…
   NWW_PIWIGO_SECRET=…
   NWW_PIWIGO_PUBLIC_URL=https://fotos.example.de   # für Links „In Piwigo öffnen“
   ```
3. Den Server neu starten: `systemctl restart nix-wie-weg-sync` bzw. `docker compose up -d`.
4. In der App unter Reise → **Fotos in Piwigo** prüfen. Dort steht „Angemeldet in Piwigo als …“.

**Wichtig:**
- Die Upload-Grenze von PHP muss für Originalfotos reichen, z. B. `upload_max_filesize = 50M` und `post_max_size = 50M` in der `php.ini` des Piwigo-Servers. Liegt ein Reverse-Proxy davor, auch dort 50 MB erlauben.
- Läuft der API-Schlüssel ab, schickt Piwigo vorher eine E-Mail. Dann einen neuen anlegen und in den Einstellungen tauschen.
- Fotos, die im Tagebuch gelöscht werden, bleiben in Piwigo.
- Piwigo nutzen darf nur der Besitzer (erster Schlüssel) und Gruppen, die er in der App freigibt.

## Reisegruppen und Lese-Links

- **Besitzer** ist der **erste** Schlüssel in `NWW_KEYS`. Nur er sieht in der App *Einstellungen → Geräte-Abgleich → Reisegruppen* und kann dort Gruppen für Freunde anlegen (eigener Schlüssel, getrennte Daten), sperren, löschen und Piwigo freigeben.
- **Lese-Links** legt jede Gruppe selbst an: Reise → *Für Freunde freigeben*. Der Link `https://<server>/s/<code>` zeigt die Reise als Seite – nur Highlights oder das ganze Tagebuch, wahlweise mit Passwort und Ablaufdatum. Dafür muss der Server die App ausliefern (`NWW_APP_DIR`, richtet `install.sh` ein).

## Geräte und Anmeldung

- Jedes Gerät bekommt beim Verbinden einen **eigenen Zugang**. Gespeichert wird auf dem Server nur eine Prüfsumme.
  In der App unter *Geräte-Abgleich → Angemeldete Geräte* siehst du alle Geräte deiner Reisegruppe und kannst
  einzelne abmelden (z. B. ein verlorenes iPad) – die anderen laufen weiter.
- **Weiteres Gerät hinzufügen:** *Gerät hinzufügen* zeigt einen QR-Code und einen Code wie `ABCD-EFGH-JKLM`.
  Er gilt einmal und 24 Stunden. Der Schlüssel der Reisegruppe muss dafür nicht mehr weitergegeben werden.
- Der Gruppenschlüssel funktioniert weiterhin (zum ersten Verbinden, für ältere App-Versionen). Geräte, die noch
  direkt mit ihm abgleichen, stellen mit der neuen App-Version von selbst auf einen eigenen Zugang um.
- Für in der App angelegte Reisegruppen kann der Besitzer einen **neuen Schlüssel** erzeugen – angemeldete Geräte bleiben angemeldet.
- Viele Fehlversuche von einer Adresse (20 in 10 Minuten) → 15 Minuten Pause. Hinter einem Reverse-Proxy im eigenen
  Netz (Nginx Proxy Manager) zählt die echte Adresse aus `X-Forwarded-For`.
- Geräte, die lange nicht da waren (`NWW_DEVICE_IDLE_DAYS`, Standard 180 Tage), werden automatisch abgemeldet.

## Offline-Karten

Die App kann den Kartenausschnitt einer Reise auf dem Gerät speichern und zeigt die Karte dann ganz ohne Internet.
Der Server schneidet dafür mit dem Programm `pmtiles` einen Ausschnitt aus der frei verfügbaren
[Protomaps-Weltkarte](https://docs.protomaps.com/basemaps/downloads) (OpenStreetMap-Daten) aus – es werden nur die
nötigen Teile geladen, je nach Größe und Detail meist 5–80 MB. Die Karten liegen unter `<daten>/maps/<gruppe>/`,
jede Reisegruppe sieht nur ihre eigenen.

Warum nicht die normale OSM-Karte speichern? Deren Nutzungsregeln verbieten das Vorab-Laden für die Offline-Nutzung.

## Datensicherung des Servers

Die Daten liegen im Docker-Volume `sync_data` (Datenbank + Fotos):

```bash
docker run --rm -v server_sync_data:/data -v "$PWD":/backup alpine tar czf /backup/nww-backup.tgz -C /data .
```

(Der Volume-Name beginnt mit dem Ordnernamen, prüfen mit `docker volume ls`.)
Zusätzlich hat jedes Gerät alle Daten lokal – fällt der Server aus, geht nichts verloren.

## Aktualisieren

```bash
cd nix-wie-weg-/server
git pull
docker compose up -d --build
```

## Einstellungen (`.env`)

| Variable | Bedeutung |
| --- | --- |
| `NWW_DOMAIN` | Domain des Servers (für das HTTPS-Zertifikat) |
| `NWW_KEYS` | Geheime Schlüssel, mind. 16 Zeichen, mehrere durch Komma |
| `NWW_ORIGINS` | Erlaubte App-Adresse(n), z. B. `https://mrcatwiesel.github.io` (Standard `*`) |
| `NWW_MAX_BLOB_MB` | Maximale Größe eines Fotos in MB (Standard 30) |
| `NWW_HOST` | Nur an diese Adresse binden, z. B. `127.0.0.1` (Standard: alle) |
| `NWW_APP_DIR` | Ordner mit der gebauten App (Inhalt von `nix-wie-weg-app.zip`); der Server liefert sie dann unter seiner Adresse aus |
| `NWW_PIWIGO_URL` | Piwigo-Adresse (im Heimnetz), leer = ohne Piwigo |
| `NWW_PIWIGO_KEY_ID` / `NWW_PIWIGO_SECRET` | Piwigo-API-Schlüssel eines Administrators |
| `NWW_PIWIGO_PUBLIC_URL` | Öffentliche Piwigo-Adresse für Links in der App |
| `NWW_DEVICE_IDLE_DAYS` | Geräte, die so viele Tage nicht abgeglichen haben, werden abgemeldet (Standard 180, `0` = nie) |
| `NWW_OVERPASS_URL` / `NWW_BROUTER_URL` | Eigene Instanzen für Wanderwege-Suche bzw. Routenplaner (Standard: overpass-api.de, brouter.de) |
| `NWW_AA_URL` | OpenData-Adresse des Auswärtigen Amts (Standard: `https://www.auswaertiges-amt.de/opendata`) |
| `NWW_PMTILES` | Pfad zum Programm `pmtiles` für Offline-Karten (Standard: `pmtiles` im Suchpfad; `update.sh` und das Docker-Image installieren es) |
| `NWW_MAPS_SOURCE` | Quelle für Kartenausschnitte (Standard: neueste Weltkarte von build.protomaps.com) |
| `NWW_BACKUP_DIR` / `NWW_BACKUP_KEEP` | Nur Proxmox: Zielordner und Anzahl der täglichen Sicherungen (`backup.sh`) |

## Schnittstelle (für Entwickler)

| Methode | Pfad | Zweck |
| --- | --- | --- |
| GET | `/` und alle Nicht-`/api`-Pfade | die App (nur mit `NWW_APP_DIR`) |
| GET | `/api/health` | Lebenszeichen (ohne Schlüssel) |
| GET | `/api/info` | Anzahl Datensätze, aktueller Stand |
| POST | `/api/push` | Änderungen hochladen `{ changes: [{ tbl, id, stamp, deleted, data }] }` – neuere gewinnt |
| GET | `/api/pull?since=N` | Änderungen seit Stand N abholen |
| HEAD/GET/PUT | `/api/blob/<sha256>` | Fotos (Inhalt wird per Prüfsumme kontrolliert) |
| GET/POST | `/api/shares` (`?tripId=`) | Lese-Links auflisten / anlegen `{ tripId, mode, photos, title, note, password, expiresDays, look }` |
| PATCH/DELETE | `/api/shares/<code>` | Lese-Link ändern (auch `revoked`) / löschen |
| GET | `/api/public/<code>` | **ohne Schlüssel:** freigegebene Inhalte (Passwort im Kopf `X-Share-Password`) |
| GET | `/api/public/<code>/photo/<id>?size=thumb\|full` | **ohne Schlüssel:** Foto eines freigegebenen Eintrags |
| GET/POST | `/api/admin/groups` | Reisegruppen auflisten / anlegen (nur Besitzer) |
| PATCH/DELETE | `/api/admin/groups/<id>` | Gruppe umbenennen, sperren, Piwigo freigeben / löschen (nur Besitzer) |
| GET | `/api/piwigo` | Piwigo-Anmeldung prüfen |
| GET/POST | `/api/piwigo/albums` | Alben auflisten / anlegen `{ name, parentId }` |
| GET/POST | `/api/piwigo/albums/<id>/images` | Fotos eines Albums (`?page=&perPage=`) / Foto hochladen (Bilddaten, `?filename=&name=`) |
| GET | `/api/piwigo/images/<id>?size=small\|xxlarge\|original` | Bilddatei |
| POST | `/api/anmelden` | Gerät anmelden → eigener Gerätezugang `nwd_…` – mit `{ invite: "ABCD-EFGH-JKLM", name }` (ohne Schlüssel) oder Gruppenschlüssel im Kopf und `{ name }` |
| GET | `/api/geraete` | angemeldete Geräte der Gruppe |
| PATCH/DELETE | `/api/geraete/<id>` (oder `ich`) | Gerät umbenennen `{ name }` / abmelden |
| POST | `/api/geraete/andere-abmelden` | alle anderen Geräte der Gruppe abmelden |
| POST | `/api/einladungen` | Einladungscode für ein weiteres Gerät (einmal gültig, 24 Stunden) |
| GET | `/api/routing/wanderwege?bbox=W,S,O,N&typ=hiking\|bicycle\|mtb&name=` | ausgeschilderte Routen im Ausschnitt (Overpass, höchstens 0,8°) |
| GET | `/api/routing/wanderwege/<id>` | Verlauf einer Route (Overpass `out geom`) |
| GET | `/api/routing/strecke?lonlats=…&profile=hiking-mountain\|trekking\|fastbike\|car-fast\|shortest` | Strecke von A nach B (BRouter, GeoJSON mit Höhen) |
| GET | `/api/reiseinfo/<CC>` | Reise- und Sicherheitshinweise des Auswärtigen Amts für ein Land (ISO-Code, z. B. `AT`; Liste 6 h, Länderseite 1 h zwischengespeichert) |
| GET | `/api/reiseinfo/<CC>/vertretungen` | Deutsche Botschaft, Konsulate und Honorarkonsuln im Land (24 h zwischengespeichert) |
| GET/POST | `/api/maps` | Offline-Karten der Gruppe auflisten / Ausschnitt bestellen `{ name, tripId, bbox: [W,S,O,N], maxzoom: 12–15 }` (höchstens 3° × 3°, eine Bestellung gleichzeitig) |
| GET/DELETE | `/api/maps/<id>` | Stand (`läuft`, `fertig`, `fehler`) / löschen |
| GET | `/api/maps/<id>/datei` | fertige PMTiles-Datei (mit `Range`-Unterstützung) |

Alle Aufrufe außer `/api/health`, `/api/public/…` und der App selbst brauchen `Authorization: Bearer <Schlüssel>`.

Tests: `node --test` (im Ordner `server`).
