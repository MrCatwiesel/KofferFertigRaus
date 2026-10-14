#!/usr/bin/env bash
# KofferFertigRaus – einmaliger Umzug vom alten Namen „nix-wie-weg“ (im Container, als root).
#
# Bis Version 1.33 hießen Ordner und Dienste nix-wie-weg. Dieses Skript benennt alles um:
#   /opt/nix-wie-weg(-app)  /etc/nix-wie-weg  /var/lib/nix-wie-weg(-update)  /var/backups/nix-wie-weg
#   /var/www/nix-wie-weg, nginx-Seite, systemd-Dienste nix-wie-weg-*, Datenbankdatei nix-wie-weg.sqlite
# Daten, Schlüssel und Einstellungen bleiben unverändert. Eigene Pfade in sync.env (z. B. eine NAS) bleiben, wie sie sind.
#
# update.sh ruft es automatisch auf. Macht nichts, wenn schon umgezogen oder neu eingerichtet.
set -euo pipefail

R=${KFR_ROOT:-} # nur für Tests: alles unterhalb dieses Ordners
OLD=nix-wie-weg
NEW=koffer-fertig-raus

[[ -d $R/opt/$OLD/.git && ! -e $R/opt/$NEW ]] || exit 0
[[ $EUID -eq 0 ]] || { echo "Bitte als root ausführen."; exit 1; }
echo "Umzug: $OLD → $NEW"

# 1. Dienste anhalten
systemctl disable -q --now "$OLD-update.timer" "$OLD-backup.timer" "$OLD-backup.path" 2>/dev/null || true
systemctl stop "$OLD-sync" 2>/dev/null || true
systemctl disable -q "$OLD-sync" 2>/dev/null || true

mv_if() {
  if [[ -e $1 || -L $1 ]] && [[ ! -e $2 && ! -L $2 ]]; then
    mv "$1" "$2"
    echo "  ${1#"$R"} → ${2#"$R"}"
  fi
}

# 2. Ordner
mv_if "$R/opt/$OLD" "$R/opt/$NEW"
mv_if "$R/opt/$OLD-app" "$R/opt/$NEW-app"
git -C "$R/opt/$NEW" remote set-url origin https://github.com/MrCatwiesel/KofferFertigRaus.git 2>/dev/null || true
mv_if "$R/opt/$OLD-app.vorher" "$R/opt/$NEW-app.vorher"
mv_if "$R/etc/$OLD" "$R/etc/$NEW"
mv_if "$R/var/lib/$OLD-update" "$R/var/lib/$NEW-update"
mv_if "$R/var/backups/$OLD" "$R/var/backups/$NEW"
mv_if "$R/var/www/$OLD" "$R/var/www/$NEW"

# Daten: mit DynamicUser liegen sie in /var/lib/private/<name>, /var/lib/<name> ist nur ein Verweis darauf
if [[ -d $R/var/lib/private/$OLD ]]; then
  mv_if "$R/var/lib/private/$OLD" "$R/var/lib/private/$NEW"
  if [[ -L $R/var/lib/$OLD ]]; then rm -f "$R/var/lib/$OLD"; fi
  [[ -e $R/var/lib/$NEW ]] || ln -s "private/$NEW" "$R/var/lib/$NEW"
  data=$R/var/lib/private/$NEW
else
  mv_if "$R/var/lib/$OLD" "$R/var/lib/$NEW"
  data=$R/var/lib/$NEW
fi
if [[ -f $data/$OLD.sqlite && ! -e $data/$NEW.sqlite ]]; then
  for x in '' -wal -shm; do
    if [[ -e $data/$OLD.sqlite$x ]]; then mv "$data/$OLD.sqlite$x" "$data/$NEW.sqlite$x"; fi
  done
  echo "  Datenbank → $NEW.sqlite"
fi

# 3. Einstellungen: nur die Standard-Pfade umschreiben
env=$R/etc/$NEW/sync.env
if [[ -f $env ]]; then
  sed -i -e "s#/opt/$OLD#/opt/$NEW#g" -e "s#/etc/$OLD/#/etc/$NEW/#g" \
    -e "s#/var/lib/$OLD#/var/lib/$NEW#g" -e "s#/var/backups/$OLD#/var/backups/$NEW#g" "$env"
fi

# 4. nginx (nur bei Einrichtung mit --web)
site=$R/etc/nginx/sites-available
if [[ -f $site/$OLD && ! -e $site/$NEW ]]; then
  sed "s#/var/www/$OLD#/var/www/$NEW#g" "$site/$OLD" > "$site/$NEW"
  rm -f "$site/$OLD" "$R/etc/nginx/sites-enabled/$OLD"
  ln -sf "/etc/nginx/sites-available/$NEW" "$R/etc/nginx/sites-enabled/$NEW"
  if [[ -z $R ]] && command -v nginx >/dev/null; then nginx -t -q && systemctl reload nginx; fi
  echo "  nginx-Seite → $NEW"
fi

# 5. Dienste unter neuem Namen einrichten und starten
units=$R/etc/systemd/system
rm -f "$units/$OLD-"*.service "$units/$OLD-"*.timer "$units/$OLD-"*.path
install -m 644 "$R/opt/$NEW/server/proxmox/$NEW-"*.service "$R/opt/$NEW/server/proxmox/$NEW-"*.timer \
  "$R/opt/$NEW/server/proxmox/$NEW-"*.path "$units/"
systemctl daemon-reload
systemctl enable -q "$NEW-sync"
systemctl enable -q --now "$NEW-update.timer" "$NEW-backup.timer" "$NEW-backup.path"
systemctl restart "$NEW-sync"
echo "Umzug fertig – Dienst heißt jetzt $NEW-sync, Programm liegt in /opt/$NEW."
