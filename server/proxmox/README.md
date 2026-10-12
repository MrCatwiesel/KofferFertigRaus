# Einrichtung auf Proxmox (zu Hause, DynDNS)

Ein kleiner **Debian-LXC-Container** reicht. Einen Datenbank-Server braucht es **nicht** – der Abgleich-Server bringt SQLite mit, alles liegt in einer Datei im Container.

## Schnellweg (empfohlen, für Variante A)

In der Proxmox-Oberfläche den Knoten auswählen → **Shell**:

```bash
curl -fsSL https://raw.githubusercontent.com/MrCatwiesel/nix-wie-weg-/main/server/proxmox/create-ct.sh -o create-ct.sh
bash create-ct.sh
```

Das Skript fragt nach Nummer, fester IP, Netzmaske, Gateway, Speicher und Festplattengröße. Danach legt es den Container an und richtet den Abgleich-Server darin ein. Am Ende zeigt es den **Schlüssel**. Weiter mit „Dann im Reverse-Proxy …“ unter Variante A.

## App vom eigenen Server (statt GitHub)

Der Abgleich-Server liefert auch die **App selbst** aus. Dann ist unter einer Adresse beides da:

- `https://reise.deine-dyndns.de` → die App (zum Installieren auf Handy/iPad/PC)
- `https://reise.deine-dyndns.de/api/…` → der Abgleich

Das Installationsskript richtet das automatisch ein: Es setzt `NWW_APP_DIR=/opt/nix-wie-weg-app`, lädt die fertig gebaute App von GitHub und sieht **täglich gegen 4 Uhr** nach Updates (`nix-wie-weg-update.timer`). Bauen muss der Container nichts.

Schon installiert? Einmal im Container:
```bash
cd /opt/nix-wie-weg && git pull && bash server/proxmox/install.sh
```
Von Hand aktualisieren: `/opt/nix-wie-weg/server/proxmox/update.sh`

> Die Daten der App gehören zur Adresse. Auf jedem Gerät die App von der neuen Adresse installieren und mit demselben Schlüssel verbinden – alles kommt vom Server zurück. Die alte Version (GitHub) danach vom Startbildschirm löschen.

## 1. Container von Hand anlegen

In Proxmox: *Create CT*

| Einstellung | Wert |
| --- | --- |
| Vorlage | Debian 12 oder 13 (Standard-Template) |
| Unprivileged | ja |
| CPU / RAM | 1 Kern / 512 MB (mit `--web` beim ersten Bau besser 2 GB, danach zurückstellen) |
| Festplatte | 8 GB + Platz für Fotos (je Reise grob 1–3 GB) |
| Netzwerk | feste IP im Heimnetz, z. B. `192.168.1.50` |

Container starten, *Console* öffnen, als root anmelden.

## 2. Variante wählen

### A) Du hast schon einen Reverse-Proxy (Nginx Proxy Manager, nginx, Traefik, Caddy …)

> Noch keinen? Das Projekt [Heim-Proxy](https://github.com/MrCatwiesel/heim-proxy) richtet einen zentralen Reverse-Proxy (Nginx Proxy Manager) für alle Server zu Hause ein. Der Eintrag für Nix wie weg steht dort in `docs/NIX-WIE-WEG.md`.

Ports 80/443 bleiben, wie sie sind. Im Container:

```bash
apt update && apt install -y curl
curl -fsSL https://raw.githubusercontent.com/MrCatwiesel/nix-wie-weg-/main/server/proxmox/install.sh | bash
```

Dann im Reverse-Proxy einen neuen Host anlegen:

- Domain: z. B. `reise.deine-dyndns.de` (Subdomain oder CNAME auf deine DynDNS-Adresse)
- Ziel: `http://192.168.1.50:8787`
- SSL: Let's Encrypt, „Force SSL“ an
- Maximale Upload-Größe auf **40 MB** stellen
  - Nginx Proxy Manager → *Advanced*: `client_max_body_size 40m;`
  - nginx: `client_max_body_size 40m;` im `server`-Block

### B) Neuer Container übernimmt Ports 80/443 (eigener Webserver mit App)

Im Router **80 und 443** auf den Container weiterleiten, dann:

```bash
apt update && apt install -y curl
curl -fsSL https://raw.githubusercontent.com/MrCatwiesel/nix-wie-weg-/main/server/proxmox/install.sh -o install.sh
bash install.sh --web reise.deine-dyndns.de
```

Das Skript installiert nginx, baut die App, holt das HTTPS-Zertifikat und richtet alles unter **einer Adresse** ein:

- `https://reise.deine-dyndns.de` → die App (statt GitHub Pages, schneller im Heimnetz)
- `https://reise.deine-dyndns.de/api/…` → der Abgleich-Server

nginx ist für die App eingestellt: gzip, Bootstrap/Icons/Skripte ein Jahr im Cache (Dateinamen mit Prüfsumme), Service Worker und Startseite immer frisch – so kommen Updates sofort an.

> Die Daten der App gehören zur Adresse: Wer bisher über GitHub Pages gearbeitet hat, verbindet beide Adressen mit demselben Server (Geräte-Abgleich), dann sind die Daten auch unter der neuen Adresse da.

## 3. Ergebnis prüfen

Am Ende zeigt das Skript den **Schlüssel**. Test von außen (Handy im Mobilfunk, nicht im WLAN):

```
https://reise.deine-dyndns.de/api/health
```

muss `{"ok":true,…}` zeigen.

## 4. App verbinden

1. App → *Einstellungen → Geräte-Abgleich*
2. Server-Adresse `https://reise.deine-dyndns.de`, Schlüssel einfügen → **Verbinden**
3. **„Kopplungs-Link teilen“** an Birgits Handy, Tablet, PC schicken → dort öffnen → Verbinden

## Pflege

| Aufgabe | Befehl im Container |
| --- | --- |
| Aktualisieren | automatisch täglich gegen 4 Uhr; von Hand `/opt/nix-wie-weg/server/proxmox/update.sh` |
| Zur vorigen Version | `/opt/nix-wie-weg/server/proxmox/update.sh zurueck` |
| Sichern | automatisch täglich gegen 3:30 Uhr; von Hand `/opt/nix-wie-weg/server/proxmox/backup.sh` |
| Sicherung zurückspielen | `/opt/nix-wie-weg/server/proxmox/restore.sh` (zeigt die Liste), dann `restore.sh <name>` |
| Status | `systemctl status nix-wie-weg-sync` · Zeitpläne: `systemctl list-timers 'nix-wie-weg*'` |
| Protokoll | `journalctl -u nix-wie-weg-sync -f` · Sicherung: `journalctl -u nix-wie-weg-backup` |
| Einstellungen | `nano /etc/nix-wie-weg/sync.env`, danach `systemctl restart nix-wie-weg-sync` |
| Daten | `/var/lib/nix-wie-weg` (Datenbank + Fotos) |

### Updates mit Sicherheitsnetz
- Vor jedem Update des Server-Programms wird automatisch gesichert.
- Startet der Server nach einem Update nicht sauber, geht `update.sh` von selbst auf die vorige Version zurück (und meldet das im Protokoll `journalctl -u nix-wie-weg-update`).
- Die vorige App-Version bleibt in `/opt/nix-wie-weg-app.vorher`; `update.sh zurueck` tauscht App und Server zurück.

### Datensicherung
`backup.sh` sichert Datenbank (sauber im laufenden Betrieb), alle Fotos und die Einstellungen (mit Schlüsseln!)
nach `/var/backups/nix-wie-weg/<datum_uhrzeit>/`. Fotos werden als harte Verknüpfungen abgelegt – 14 Sicherungen
brauchen kaum mehr Platz als eine. Die neuesten 14 bleiben, ältere werden gelöscht.

Einstellbar in `/etc/nix-wie-weg/sync.env`:
```
NWW_BACKUP_DIR=/mnt/sicherung/nix-wie-weg   # Zielordner
NWW_BACKUP_KEEP=14                         # Anzahl Sicherungen
```

**Empfehlung: Sicherung auf eine andere Platte.** Eine Sicherung im selben Container hilft gegen Bedienfehler,
nicht gegen einen Plattenschaden. In Proxmox einen Ordner einer anderen Platte/NAS in den Container einhängen
(auf dem Proxmox-Host, Container-ID anpassen):
```
pct set <CTID> -mp0 /mnt/pve/<speicher>/nix-wie-weg-sicherung,mp=/mnt/sicherung
```
und dann `NWW_BACKUP_DIR=/mnt/sicherung/nix-wie-weg` setzen. Zusätzlich den Container in die geplante
Proxmox-Sicherung aufnehmen (*Datacenter → Backup*, Modus „Snapshot“) – doppelt hält besser.

**Zurückspielen:** `restore.sh <name>` legt den aktuellen Stand vorher beiseite, spielt die Sicherung ein und
startet den Server neu. Die Geräte merken das beim nächsten Abgleich und gleichen einmal vollständig ab –
was auf einem Gerät neuer ist als die Sicherung, geht dabei nicht verloren.

## Wenn es nicht klappt

| Meldung / Verhalten | Ursache |
| --- | --- |
| App: „Server nicht erreichbar“ | DynDNS zeigt nicht auf die aktuelle IP, Portweiterleitung fehlt, oder Test nur im WLAN (manche Router können kein „NAT-Loopback“ – dann im Mobilfunk testen) |
| App: Hinweis zu http/https | Adresse mit `https://` eintragen; ohne Zertifikat geht es nicht |
| Zertifikat schlägt fehl | Port 80 muss von außen auf den Container (B) bzw. den Reverse-Proxy (A) zeigen |
| Fotos werden nicht übertragen | Upload-Grenze im Reverse-Proxy auf 40 MB stellen |
| Anbieter vergibt nur IPv6 (DS-Lite) | Portweiterleitung von außen über IPv4 geht nicht – AAAA-Eintrag für den Container im DynDNS setzen, oder Tunnel (z. B. Cloudflare Tunnel) nutzen |
