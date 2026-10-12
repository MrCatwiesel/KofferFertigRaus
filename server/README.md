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
- Der Piwigo-Zugang gilt für alle Reisegruppen auf diesem Server.

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

## Schnittstelle (für Entwickler)

| Methode | Pfad | Zweck |
| --- | --- | --- |
| GET | `/` und alle Nicht-`/api`-Pfade | die App (nur mit `NWW_APP_DIR`) |
| GET | `/api/health` | Lebenszeichen (ohne Schlüssel) |
| GET | `/api/info` | Anzahl Datensätze, aktueller Stand |
| POST | `/api/push` | Änderungen hochladen `{ changes: [{ tbl, id, stamp, deleted, data }] }` – neuere gewinnt |
| GET | `/api/pull?since=N` | Änderungen seit Stand N abholen |
| HEAD/GET/PUT | `/api/blob/<sha256>` | Fotos (Inhalt wird per Prüfsumme kontrolliert) |
| GET | `/api/piwigo` | Piwigo-Anmeldung prüfen |
| GET/POST | `/api/piwigo/albums` | Alben auflisten / anlegen `{ name, parentId }` |
| GET/POST | `/api/piwigo/albums/<id>/images` | Fotos eines Albums (`?page=&perPage=`) / Foto hochladen (Bilddaten, `?filename=&name=`) |
| GET | `/api/piwigo/images/<id>?size=small\|xxlarge\|original` | Bilddatei |

Alle Aufrufe außer `/api/health` brauchen `Authorization: Bearer <Schlüssel>`.

Tests: `node --test` (im Ordner `server`).
