#!/usr/bin/env bash
# Nix wie weg – Abgleich-Server und App aktualisieren (im Container, als root).
# Läuft täglich automatisch (nix-wie-weg-update.timer) und kann jederzeit von Hand gestartet werden:
#   /opt/nix-wie-weg/server/proxmox/update.sh
set -euo pipefail

SRC=/opt/nix-wie-weg
APP=/opt/nix-wie-weg-app
APP_URL="https://github.com/MrCatwiesel/nix-wie-weg-/releases/download/app/nix-wie-weg-app.zip"

[[ $EUID -eq 0 ]] || { echo "Bitte als root ausführen."; exit 1; }

# 1. Programm des Servers (Git)
old=$(git -C "$SRC" rev-parse HEAD)
git -C "$SRC" pull --ff-only -q
new=$(git -C "$SRC" rev-parse HEAD)

# 2. Fertig gebaute App (wird bei jeder Änderung auf GitHub automatisch erstellt)
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
if curl -fsSL "$APP_URL" -o "$tmp/app.zip" && unzip -q "$tmp/app.zip" -d "$tmp/app" && [[ -f $tmp/app/index.html ]]; then
  if cmp -s "$tmp/app/app-version.txt" "$APP/app-version.txt" 2>/dev/null; then
    echo "App ist aktuell ($(head -n1 "$APP/app-version.txt"))."
  else
    chmod -R a+rX "$tmp/app"
    rm -rf "$APP.new" "$APP.old"
    mv "$tmp/app" "$APP.new"
    [[ -d $APP ]] && mv "$APP" "$APP.old"
    mv "$APP.new" "$APP"
    rm -rf "$APP.old"
    echo "App aktualisiert auf $(head -n1 "$APP/app-version.txt")."
  fi
else
  echo "!! App konnte nicht geladen werden – die bisherige bleibt in Betrieb." >&2
fi

# 3. Dienst neu starten, wenn sich das Server-Programm geändert hat
if [[ $old != "$new" ]]; then
  install -m 644 "$SRC/server/proxmox/nix-wie-weg-sync.service" /etc/systemd/system/
  install -m 644 "$SRC/server/proxmox/nix-wie-weg-update.service" "$SRC/server/proxmox/nix-wie-weg-update.timer" /etc/systemd/system/
  systemctl daemon-reload
  systemctl restart nix-wie-weg-sync
  echo "Abgleich-Server aktualisiert und neu gestartet."
fi
