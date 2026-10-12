#!/usr/bin/env bash
# Nix wie weg – Datensicherung des Abgleich-Servers (im Container, als root).
# Läuft täglich automatisch (nix-wie-weg-backup.timer) und kann jederzeit von Hand gestartet werden:
#   /opt/nix-wie-weg/server/proxmox/backup.sh
#
# Zusätzlich überträgt es die Sicherung an die Ziele, die du in der App einträgst
# (Einstellungen → Geräte-Abgleich → Server-Sicherung): Ordner/Platte, SMB-Freigabe, SSH/rsync, WebDAV.
# Die App kann eine Sicherung oder einen Test anstoßen (Datei <daten>/sicherung/jetzt → nix-wie-weg-backup.path).
#
# Gesichert werden:
#   - die Datenbank (Reisen, Tagebuch, Gruppen, Lese-Links …) – sauber im laufenden Betrieb (VACUUM INTO)
#   - alle Fotos/Dateien (als harte Verknüpfungen: jede Datei liegt nur einmal auf der Platte,
#     auch wenn sie in 14 Sicherungen vorkommt)
#   - die Einstellungen /etc/nix-wie-weg/sync.env (enthält die Schlüssel – Ordner nur für root lesbar)
#
# Einstellungen (in /etc/nix-wie-weg/sync.env, optional):
#   NWW_BACKUP_DIR=/var/backups/nix-wie-weg   Zielordner – am besten eine andere Platte/NAS (siehe README)
#   NWW_BACKUP_KEEP=14                        so viele Sicherungen bleiben erhalten
set -euo pipefail

ENVFILE=/etc/nix-wie-weg/sync.env
DATA=${NWW_DATA:-/var/lib/nix-wie-weg}
# shellcheck disable=SC1090
[[ -f $ENVFILE ]] && source <(grep -E '^NWW_BACKUP_(DIR|KEEP)=' "$ENVFILE" || true)
DEST=${NWW_BACKUP_DIR:-/var/backups/nix-wie-weg}
KEEP=${NWW_BACKUP_KEEP:-14}

HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
RUNNER="$HERE/../backup-run.mjs"

[[ $EUID -eq 0 ]] || { echo "Bitte als root ausführen."; exit 1; }
[[ -f $DATA/nix-wie-weg.sqlite ]] || { echo "Keine Daten in $DATA – nichts zu sichern."; exit 0; }

# Auftrag aus der App? (Sicherung jetzt / Ziel testen)
SB="$DATA/sicherung"
install -d -m 700 "$SB"
chown --reference="$DATA" "$SB"
touch "$SB/eingerichtet" && chown --reference="$DATA" "$SB/eingerichtet"
order=""
if [[ -f $SB/jetzt ]]; then
  order=$(mktemp)
  mv "$SB/jetzt" "$order"
  trap 'rm -f "$order"' EXIT
  if grep -q '"mode":"test"' "$order"; then
    node --no-warnings "$RUNNER" --daten "$DATA" --auftrag "$order"
    exit $?
  fi
fi
[[ $KEEP =~ ^[0-9]+$ && $KEEP -ge 1 ]] || { echo "NWW_BACKUP_KEEP muss eine Zahl ≥ 1 sein."; exit 1; }

install -d -m 700 "$DEST"
stamp=$(date +%Y-%m-%d_%H%M)
work="$DEST/.$stamp.unfertig"
rm -rf "$work"
install -d -m 700 "$work"

# 1. Datenbank: konsistente Kopie, auch während Geräte gerade abgleichen
node --no-warnings -e '
  const { DatabaseSync } = require("node:sqlite")
  const [src, dst] = process.argv.slice(1)
  new DatabaseSync(src).exec("VACUUM INTO \x27" + dst.replace(/\x27/g, "\x27\x27") + "\x27")
  const res = new DatabaseSync(dst).prepare("PRAGMA integrity_check").get()
  if (Object.values(res)[0] !== "ok") { console.error("Prüfung der Sicherung fehlgeschlagen"); process.exit(1) }
' "$DATA/nix-wie-weg.sqlite" "$work/nix-wie-weg.sqlite"

# Falls dabei Hilfsdateien der Datenbank neu entstanden sind: dem Dienst zurückgeben
for f in "$DATA/nix-wie-weg.sqlite-wal" "$DATA/nix-wie-weg.sqlite-shm"; do
  if [[ -e $f ]]; then chown --reference="$DATA/nix-wie-weg.sqlite" "$f"; fi
done

# 2. Fotos/Dateien: ändern sich nie (Name = Prüfsumme) → harte Verknüpfungen sparen Platz
if [[ -d $DATA/blobs ]]; then
  cp -al "$DATA/blobs" "$work/blobs" 2>/dev/null || cp -a "$DATA/blobs" "$work/blobs"
fi

# 3. Einstellungen
if [[ -f $ENVFILE ]]; then cp -a "$ENVFILE" "$work/sync.env"; fi

mv "$work" "$DEST/$stamp"
size=$(du -sh "$DEST/$stamp" | cut -f1)
echo "Sicherung $DEST/$stamp erstellt ($size, Fotos als Verknüpfungen)."

# 4. Alte Sicherungen entfernen (die neuesten $KEEP bleiben)
mapfile -t all < <(find "$DEST" -mindepth 1 -maxdepth 1 -type d -name '20*' -printf '%f\n' | sort)
if (( ${#all[@]} > KEEP )); then
  for old in "${all[@]:0:${#all[@]}-KEEP}"; do
    rm -rf "${DEST:?}/$old"
    echo "Alte Sicherung $old entfernt."
  done
fi
find "$DEST" -mindepth 1 -maxdepth 1 -type d -name '.*.unfertig' -mtime +1 -exec rm -rf {} +

# 5. An die weiteren Ziele übertragen (in der App eingetragen)
if [[ -f $RUNNER ]]; then
  node --no-warnings "$RUNNER" --daten "$DATA" --snapshot "$DEST/$stamp" --groesse "$size" ${order:+--auftrag "$order"}
fi
