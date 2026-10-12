#!/usr/bin/env bash
# Nix wie weg – Einrichtung in einem Debian-LXC-Container (Proxmox), ohne Docker.
#
#   bash install.sh                     nur Abgleich-Server (Port 8787, für vorhandenen Reverse-Proxy)
#   bash install.sh --web reise.example.de
#                                       zusätzlich nginx + App + HTTPS (Let's Encrypt) im Container
#
# Erneut ausführen = aktualisieren (Einstellungen und Daten bleiben erhalten).
set -euo pipefail

REPO="https://github.com/MrCatwiesel/nix-wie-weg-.git"
SRC=/opt/nix-wie-weg
ENVFILE=/etc/nix-wie-weg/sync.env
WEBROOT=/var/www/nix-wie-weg
DOMAIN=""
[[ "${1:-}" == "--web" ]] && DOMAIN="${2:?Domain fehlt, z. B. --web reise.example.de}"

[[ $EUID -eq 0 ]] || { echo "Bitte als root ausführen."; exit 1; }
say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }

say "Pakete installieren"
apt-get update -qq
apt-get install -y -qq ca-certificates curl git openssl unzip >/dev/null

need_node=1
if command -v node >/dev/null; then
  v=$(node -p 'process.versions.node.split(".").map(Number).reduce((a,b,i)=>a+b*[1e6,1e3,1][i],0)')
  (( v >= 22013000 )) && need_node=0
fi
if (( need_node )); then
  say "Node.js 22 installieren (NodeSource)"
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "Node.js $(node -v)"

say "Programm holen nach $SRC"
if [[ -d $SRC/.git ]]; then git -C "$SRC" pull --ff-only -q; else git clone -q "$REPO" "$SRC"; fi

say "Einstellungen ($ENVFILE)"
mkdir -p "$(dirname "$ENVFILE")"
if [[ ! -f $ENVFILE ]]; then
  KEY=$(openssl rand -hex 16)
  ORIGINS="https://mrcatwiesel.github.io"
  [[ -n $DOMAIN ]] && ORIGINS="$ORIGINS,https://$DOMAIN"
  cat > "$ENVFILE" <<EOF
# Geheime Schlüssel der Reisegruppen (mind. 16 Zeichen, mehrere durch Komma)
NWW_KEYS=$KEY
# Erlaubte App-Adressen
NWW_ORIGINS=$ORIGINS
# Maximale Fotogröße in MB
NWW_MAX_BLOB_MB=30
PORT=8787
# 127.0.0.1 = nur nginx im Container darf zugreifen; leer = auch andere Rechner im Heimnetz
NWW_HOST=$([[ -n $DOMAIN ]] && echo 127.0.0.1)

# Optional: Piwigo anbinden (ab 16.1) – Adresse im Heimnetz und API-Schlüssel eines Administrators
NWW_PIWIGO_URL=
NWW_PIWIGO_KEY_ID=
NWW_PIWIGO_SECRET=
# Öffentliche Piwigo-Adresse für Links, z. B. https://fotos.example.de
NWW_PIWIGO_PUBLIC_URL=
EOF
  chmod 600 "$ENVFILE"
  NEWKEY=$KEY
fi

# Die App selbst vom Server ausliefern (gleiche Adresse wie der Abgleich)
if ! grep -q '^NWW_APP_DIR=' "$ENVFILE"; then
  printf '\n# Gebaute App, die der Server unter seiner Adresse ausliefert (leer = nur Abgleich)\nNWW_APP_DIR=/opt/nix-wie-weg-app\n' >> "$ENVFILE"
fi

say "App herunterladen"
bash "$SRC/server/proxmox/update.sh" || true

say "Dienst einrichten"
install -m 644 "$SRC/server/proxmox/nix-wie-weg-sync.service" "$SRC/server/proxmox/nix-wie-weg-update.service" "$SRC/server/proxmox/nix-wie-weg-update.timer" \
  "$SRC/server/proxmox/nix-wie-weg-backup.service" "$SRC/server/proxmox/nix-wie-weg-backup.timer" "$SRC/server/proxmox/nix-wie-weg-backup.path" /etc/systemd/system/
systemctl daemon-reload
systemctl enable -q nix-wie-weg-sync
systemctl enable -q --now nix-wie-weg-update.timer nix-wie-weg-backup.timer nix-wie-weg-backup.path
systemctl restart nix-wie-weg-sync
sleep 2
curl -fsS http://127.0.0.1:8787/api/health && echo

if [[ -n $DOMAIN ]]; then
  say "App bauen"
  cd "$SRC"
  npm ci --no-audit --no-fund --loglevel=error
  npm run build --silent
  mkdir -p "$WEBROOT"
  rm -rf "${WEBROOT:?}"/*
  cp -r dist/. "$WEBROOT"/

  say "nginx einrichten für $DOMAIN"
  apt-get install -y -qq nginx certbot python3-certbot-nginx >/dev/null
  if [[ ! -f /etc/nginx/sites-available/nix-wie-weg ]]; then
    sed "s/DOMAIN/$DOMAIN/" "$SRC/server/proxmox/nginx-nix-wie-weg.conf" > /etc/nginx/sites-available/nix-wie-weg
    ln -sf /etc/nginx/sites-available/nix-wie-weg /etc/nginx/sites-enabled/nix-wie-weg
    rm -f /etc/nginx/sites-enabled/default
  fi
  nginx -t -q && systemctl reload nginx

  if [[ ! -d /etc/letsencrypt/live/$DOMAIN ]]; then
    say "HTTPS-Zertifikat holen (Port 80 muss auf diesen Container weitergeleitet sein)"
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect \
      || echo "!! Zertifikat fehlgeschlagen – Portweiterleitung 80/443 und DynDNS prüfen, dann: certbot --nginx -d $DOMAIN"
  fi
fi

say "Fertig"
IP=$(hostname -I | awk '{print $1}')
if [[ -n $DOMAIN ]]; then
  echo "App:        https://$DOMAIN"
  echo "Server-URL: https://$DOMAIN   (in der App: Einstellungen → Geräte-Abgleich)"
else
  echo "Abgleich-Server und App laufen auf http://$IP:8787"
  echo "→ Im Reverse-Proxy https://<deine-domain> auf http://$IP:8787 weiterleiten – dann ist dort App und Abgleich."
fi
[[ -n ${NEWKEY:-} ]] && echo "Schlüssel:  $NEWKEY   (steht auch in $ENVFILE)"
echo "Status:     systemctl status nix-wie-weg-sync   ·   Protokoll: journalctl -u nix-wie-weg-sync -f"
