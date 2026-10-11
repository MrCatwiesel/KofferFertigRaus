# Einrichtung auf Proxmox (zu Hause, DynDNS)

Ein kleiner **Debian-LXC-Container** reicht. Einen Datenbank-Server braucht es **nicht** – der Abgleich-Server bringt SQLite mit, alles liegt in einer Datei im Container.

## 1. Container anlegen

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
| Aktualisieren | `bash /opt/nix-wie-weg/server/proxmox/install.sh` (bei B: `--web <domain>` anhängen) |
| Status | `systemctl status nix-wie-weg-sync` |
| Protokoll | `journalctl -u nix-wie-weg-sync -f` |
| Einstellungen | `nano /etc/nix-wie-weg/sync.env`, danach `systemctl restart nix-wie-weg-sync` |
| Daten | `/var/lib/nix-wie-weg` (Datenbank + Fotos) |

**Sicherung:** Den Container in Proxmox in die geplante Sicherung aufnehmen (*Datacenter → Backup*, Modus „Snapshot“). Zusätzlich hat jedes Gerät alle Daten lokal.

## Wenn es nicht klappt

| Meldung / Verhalten | Ursache |
| --- | --- |
| App: „Server nicht erreichbar“ | DynDNS zeigt nicht auf die aktuelle IP, Portweiterleitung fehlt, oder Test nur im WLAN (manche Router können kein „NAT-Loopback“ – dann im Mobilfunk testen) |
| App: Hinweis zu http/https | Adresse mit `https://` eintragen; ohne Zertifikat geht es nicht |
| Zertifikat schlägt fehl | Port 80 muss von außen auf den Container (B) bzw. den Reverse-Proxy (A) zeigen |
| Fotos werden nicht übertragen | Upload-Grenze im Reverse-Proxy auf 40 MB stellen |
| Anbieter vergibt nur IPv6 (DS-Lite) | Portweiterleitung von außen über IPv4 geht nicht – AAAA-Eintrag für den Container im DynDNS setzen, oder Tunnel (z. B. Cloudflare Tunnel) nutzen |
