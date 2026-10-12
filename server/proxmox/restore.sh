#!/usr/bin/env bash
# Nix wie weg – Datensicherung zurückspielen (im Container, als root).
#   /opt/nix-wie-weg/server/proxmox/restore.sh             zeigt die vorhandenen Sicherungen
#   /opt/nix-wie-weg/server/proxmox/restore.sh 2026-10-12_0415   spielt diese Sicherung zurück
#
# Der aktuelle Stand wird vorher beiseitegelegt (…/nix-wie-weg.vor-wiederherstellung-<zeit>),
# es geht also nichts verloren. Die Einstellungen (sync.env) werden NICHT überschrieben –
# eine Kopie liegt in der Sicherung, falls du sie brauchst.
set -euo pipefail

ENVFILE=/etc/nix-wie-weg/sync.env
DATA=${NWW_DATA:-/var/lib/nix-wie-weg}
# shellcheck disable=SC1090
[[ -f $ENVFILE ]] && source <(grep -E '^NWW_BACKUP_DIR=' "$ENVFILE" || true)
DEST=${NWW_BACKUP_DIR:-/var/backups/nix-wie-weg}

[[ $EUID -eq 0 ]] || { echo "Bitte als root ausführen."; exit 1; }

if [[ $# -eq 0 ]]; then
  echo "Vorhandene Sicherungen in $DEST:"
  find "$DEST" -mindepth 1 -maxdepth 1 -type d -name '20*' -printf '  %f\n' 2>/dev/null | sort || true
  echo
  echo "Zurückspielen: $0 <name>"
  exit 0
fi

name=$1
src="$DEST/$name"
[[ $name =~ ^20[0-9_-]+$ && -f $src/nix-wie-weg.sqlite ]] || { echo "Sicherung „$name“ nicht gefunden."; exit 1; }

read -r -p "Daten des Abgleich-Servers durch die Sicherung $name ersetzen? (ja/nein) " answer
[[ $answer == ja ]] || { echo "Abgebrochen."; exit 0; }

service=0
if command -v systemctl >/dev/null && systemctl is-active -q nix-wie-weg-sync 2>/dev/null; then
  systemctl stop nix-wie-weg-sync
  service=1
fi

real=$(readlink -f "$DATA")
aside="$real.vor-wiederherstellung-$(date +%Y-%m-%d_%H%M)"
cp -a "$real" "$aside"
echo "Bisheriger Stand liegt in $aside"

rm -f "$real/nix-wie-weg.sqlite" "$real/nix-wie-weg.sqlite-wal" "$real/nix-wie-weg.sqlite-shm"
cp "$src/nix-wie-weg.sqlite" "$real/nix-wie-weg.sqlite"
# Neue Kennung des Datenbestands → alle Geräte gleichen einmal vollständig ab (ihre neueren Stände gehen nicht verloren)
node --no-warnings -e '
  const { DatabaseSync } = require("node:sqlite")
  new DatabaseSync(process.argv[1]).exec("DELETE FROM settings WHERE key = \x27sync-epoch\x27")
' "$real/nix-wie-weg.sqlite"
rm -rf "$real/blobs"
if [[ -d $src/blobs ]]; then
  cp -al "$src/blobs" "$real/blobs" 2>/dev/null || cp -a "$src/blobs" "$real/blobs"
else
  mkdir "$real/blobs"
fi
# Dateien gehören dem Dienst (nicht root)
chown -R --reference="$real" "$real"/nix-wie-weg.sqlite* "$real/blobs"

if [[ $service -eq 1 ]]; then
  systemctl start nix-wie-weg-sync
  sleep 2
  curl -fsS http://127.0.0.1:8787/api/health && echo
fi
echo "Sicherung $name zurückgespielt. Die Geräte gleichen beim nächsten Öffnen der App automatisch ab."
