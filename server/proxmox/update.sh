#!/usr/bin/env bash
# Nix wie weg – Abgleich-Server und App aktualisieren (im Container, als root).
# Läuft täglich automatisch (nix-wie-weg-update.timer) und kann jederzeit von Hand gestartet werden:
#   /opt/nix-wie-weg/server/proxmox/update.sh            aktualisieren
#   /opt/nix-wie-weg/server/proxmox/update.sh zurueck    zur vorigen Version von App und Server zurück
#
# Sicherheitsnetz:
#   - vor jedem Server-Update wird eine Datensicherung angelegt (backup.sh)
#   - startet der Server nach dem Update nicht sauber, geht er automatisch auf die vorige Version zurück
#   - die vorige App bleibt in /opt/nix-wie-weg-app.vorher liegen (für "zurueck")
set -euo pipefail

SRC=/opt/nix-wie-weg
APP=/opt/nix-wie-weg-app
PREV_APP=$APP.vorher
STATE=/var/lib/nix-wie-weg-update
APP_URL="https://github.com/MrCatwiesel/nix-wie-weg-/releases/download/app/nix-wie-weg-app.zip"
HEALTH=http://127.0.0.1:8787/api/health
HERE="$SRC/server/proxmox"

[[ $EUID -eq 0 ]] || { echo "Bitte als root ausführen."; exit 1; }
install -d -m 700 "$STATE"

healthy() {
  local i
  for i in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    curl -fsS --max-time 3 "$HEALTH" >/dev/null 2>&1 && return 0
  done
  return 1
}

# systemd-Einheiten auf den Stand im Repository bringen (jedes Mal, ist harmlos)
install_units() {
  install -m 644 "$HERE/nix-wie-weg-sync.service" "$HERE/nix-wie-weg-update.service" "$HERE/nix-wie-weg-update.timer" \
    "$HERE/nix-wie-weg-backup.service" "$HERE/nix-wie-weg-backup.timer" /etc/systemd/system/
  systemctl daemon-reload
  systemctl enable -q --now nix-wie-weg-update.timer nix-wie-weg-backup.timer
}

restart_server() {
  systemctl restart nix-wie-weg-sync
  healthy
}

# ---------- Zurück zur vorigen Version ----------
if [[ ${1:-} == zurueck ]]; then
  if [[ -d $PREV_APP ]]; then
    rm -rf "$APP.tausch"
    mv "$APP" "$APP.tausch" && mv "$PREV_APP" "$APP" && mv "$APP.tausch" "$PREV_APP"
    echo "App zurück auf $(head -n1 "$APP/app-version.txt" 2>/dev/null || echo 'vorige Version')."
  else
    echo "Keine vorige App vorhanden."
  fi
  if [[ -f $STATE/server-vorher ]]; then
    prev=$(cat "$STATE/server-vorher")
    git -C "$SRC" checkout -q --detach "$prev"
    restart_server && echo "Server zurück auf ${prev:0:7}." || echo "!! Server startet auch mit ${prev:0:7} nicht – bitte: journalctl -u nix-wie-weg-sync -n 50"
    echo "Hinweis: Das nächste automatische Update holt wieder den neuesten Stand."
    echo "         Um das zu verhindern: systemctl disable --now nix-wie-weg-update.timer"
  fi
  exit 0
fi

# ---------- 1. Programm des Servers (Git) ----------
git -C "$SRC" checkout -q main 2>/dev/null || true # nach "zurueck" wieder auf den Hauptzweig
old=$(git -C "$SRC" rev-parse HEAD)
git -C "$SRC" pull --ff-only -q
new=$(git -C "$SRC" rev-parse HEAD)

# Hat sich dieses Skript selbst geändert? Dann gleich mit der neuen Fassung weitermachen.
if [[ $old != "$new" && -z ${NWW_UPDATE_NEU:-} ]] && ! git -C "$SRC" diff --quiet "$old" "$new" -- server/proxmox/update.sh; then
  echo "Update-Skript wurde erneuert – starte neue Fassung."
  NWW_UPDATE_NEU=1 NWW_UPDATE_ALT=$old exec bash "$HERE/update.sh" "$@"
fi
[[ -n ${NWW_UPDATE_ALT:-} ]] && old=$NWW_UPDATE_ALT

# ---------- 2. Fertig gebaute App ----------
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
if curl -fsSL "$APP_URL" -o "$tmp/app.zip" && unzip -q "$tmp/app.zip" -d "$tmp/app" && [[ -f $tmp/app/index.html ]]; then
  if cmp -s "$tmp/app/app-version.txt" "$APP/app-version.txt" 2>/dev/null; then
    echo "App ist aktuell ($(head -n1 "$APP/app-version.txt"))."
  else
    chmod -R a+rX "$tmp/app"
    rm -rf "$APP.neu" "$PREV_APP"
    mv "$tmp/app" "$APP.neu"
    [[ -d $APP ]] && mv "$APP" "$PREV_APP"
    mv "$APP.neu" "$APP"
    echo "App aktualisiert auf $(head -n1 "$APP/app-version.txt") (vorige Version bleibt für 'update.sh zurueck')."
  fi
else
  echo "!! App konnte nicht geladen werden – die bisherige bleibt in Betrieb." >&2
fi

# ---------- 3. Server neu starten, wenn sich sein Programm geändert hat ----------
if [[ $old != "$new" ]]; then
  echo "$old" > "$STATE/server-vorher"
  if [[ -x $HERE/backup.sh ]]; then
    bash "$HERE/backup.sh" || echo "!! Sicherung vor dem Update fehlgeschlagen – Update läuft trotzdem weiter." >&2
  fi
  install_units
  if restart_server; then
    echo "Abgleich-Server aktualisiert (${old:0:7} → ${new:0:7}) und läuft."
  else
    echo "!! Server startet mit ${new:0:7} nicht – gehe zurück auf ${old:0:7}." >&2
    git -C "$SRC" checkout -q --detach "$old"
    install_units
    if restart_server; then
      echo "Server läuft wieder mit ${old:0:7}. Fehlerbericht: journalctl -u nix-wie-weg-sync -n 50" >&2
    else
      echo "!! Server startet auch mit ${old:0:7} nicht – bitte: journalctl -u nix-wie-weg-sync -n 50" >&2
    fi
    exit 1
  fi
else
  install_units
fi
