#!/usr/bin/env bash
# KofferFertigRaus – Abgleich-Server und App aktualisieren (im Container, als root).
# Läuft täglich automatisch (koffer-fertig-raus-update.timer) und kann jederzeit von Hand gestartet werden:
#   /opt/koffer-fertig-raus/server/proxmox/update.sh                 aktualisieren (im eingestellten Kanal)
#   /opt/koffer-fertig-raus/server/proxmox/update.sh zurueck         zur vorigen Version von App und Server zurück
#   /opt/koffer-fertig-raus/server/proxmox/update.sh kanal           zeigt den Kanal
#   /opt/koffer-fertig-raus/server/proxmox/update.sh kanal 1.x       Kanal wechseln und gleich aktualisieren:
#        main      neueste Fassung (Standard)
#        1.x       nur noch Fehlerbehebungen der Version 1 – kein Sprung auf 2.0
#        v1.43.0   genau diese Version, keine Updates mehr (fest)
#   /opt/koffer-fertig-raus/server/proxmox/update.sh version 1.43.0  dasselbe wie „kanal v1.43.0“
#
# Sicherheitsnetz:
#   - vor jedem Server-Update wird eine Datensicherung angelegt (backup.sh)
#   - startet der Server nach dem Update nicht sauber, geht er automatisch auf die vorige Version zurück
#   - die vorige App bleibt in /opt/koffer-fertig-raus-app.vorher liegen (für "zurueck")
set -euo pipefail

R=${KFR_ROOT:-} # nur für Tests: alles unterhalb dieses Ordners
SRC=$R/opt/koffer-fertig-raus
APP=$R/opt/koffer-fertig-raus-app
PREV_APP=$APP.vorher
STATE=$R/var/lib/koffer-fertig-raus-update
RELEASES=${KFR_RELEASES:-https://github.com/MrCatwiesel/KofferFertigRaus/releases/download}
HEALTH=http://127.0.0.1:8787/api/health
HERE="$SRC/server/proxmox"

[[ $EUID -eq 0 ]] || { echo "Bitte als root ausführen."; exit 1; }

# Einmaliger Umzug vom alten Namen (bis 1.33 hieß alles „nix-wie-weg“), danach mit dieser Fassung am neuen Ort weiter
if [[ -z $R && -d /opt/nix-wie-weg/.git && ! -e $SRC ]]; then
  bash /opt/nix-wie-weg/server/proxmox/umzug.sh
  exec bash "$HERE/update.sh" "$@"
fi
install -d -m 700 "$STATE"

# ---------- Kanal: welcher Stand installiert wird ----------
# main = neueste Fassung · 1.x (o. ä.) = Wartungszweig · vX.Y.Z = feste Version
kanal() { local k; k=$(cat "$STATE/kanal" 2>/dev/null || true); echo "${k:-main}"; }
valid_kanal() { [[ $1 =~ ^(main|[0-9]+\.x|v[0-9]+\.[0-9]+\.[0-9]+)$ ]]; }
# Release mit der fertigen App: main → „app“, Zweig 1.x → „app-1.x“, Version → ihr eigenes Release
app_release() { case $1 in main) echo app ;; v*) echo "$1" ;; *) echo "app-$1" ;; esac; }

if [[ ${1:-} == version ]]; then
  [[ -n ${2:-} ]] || { echo "Welche Version? z. B.: update.sh version 1.43.0"; exit 1; }
  set -- kanal "v${2#v}"
fi
if [[ ${1:-} == kanal ]]; then
  if [[ -z ${2:-} ]]; then
    echo "Kanal: $(kanal)"
    exit 0
  fi
  valid_kanal "$2" || { echo "Unbekannter Kanal „$2“ – möglich: main, 1.x, v1.43.0 …"; exit 1; }
  if [[ $2 == v* ]]; then
    git -C "$SRC" fetch -q origin "+refs/tags/$2:refs/tags/$2" 2>/dev/null || { echo "Version $2 gibt es nicht."; exit 1; }
    echo "Hinweis: Ein Server, der schon eine neuere Version hatte, kann mit einer älteren Datenbank-Fassung"
    echo "         Probleme haben. Sicherster Rückweg ist die Momentaufnahme des Containers (pct rollback)."
  elif [[ $2 != main ]]; then
    git -C "$SRC" fetch -q origin "+refs/heads/$2:refs/remotes/origin/$2" 2>/dev/null || { echo "Kanal $2 gibt es nicht."; exit 1; }
  fi
  echo "$2" > "$STATE/kanal"
  echo "Kanal ist jetzt: $2"
  exec bash "$HERE/update.sh"
fi
KANAL=$(kanal)
valid_kanal "$KANAL" || { echo "!! Kanal „$KANAL“ in $STATE/kanal ist ungültig." >&2; exit 1; }
APP_URL="$RELEASES/$(app_release "$KANAL")/koffer-fertig-raus-app.zip"

# Stände von vor der Umbenennung erwarten die alten Ordner und Dienste → dorthin nicht zurück
after_rename() { git -C "$SRC" cat-file -e "$1:server/proxmox/umzug.sh" 2>/dev/null; }

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
  local units=() u
  for u in koffer-fertig-raus-sync.service koffer-fertig-raus-update.service koffer-fertig-raus-update.timer \
    koffer-fertig-raus-backup.service koffer-fertig-raus-backup.timer koffer-fertig-raus-backup.path; do
    [[ -f $HERE/$u ]] && units+=("$HERE/$u") # ältere Versionen (nach Rückweg) haben nicht alle
  done
  install -d "$R/etc/systemd/system"
  install -m 644 "${units[@]}" "$R/etc/systemd/system/"
  systemctl daemon-reload
  for u in koffer-fertig-raus-update.timer koffer-fertig-raus-backup.timer koffer-fertig-raus-backup.path; do
    if [[ -f $R/etc/systemd/system/$u ]]; then systemctl enable -q --now "$u"; fi
  done
}

restart_server() {
  systemctl restart koffer-fertig-raus-sync
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
    if ! after_rename "$prev"; then
      echo "Server bleibt auf dem aktuellen Stand: ${prev:0:7} ist von vor der Umbenennung und passt nicht mehr zu Ordnern und Diensten."
      exit 0
    fi
    git -C "$SRC" checkout -q --detach "$prev"
    restart_server && echo "Server zurück auf ${prev:0:7}." || echo "!! Server startet auch mit ${prev:0:7} nicht – bitte: journalctl -u koffer-fertig-raus-sync -n 50"
    echo "Hinweis: Das nächste automatische Update holt wieder den neuesten Stand."
    echo "         Um das zu verhindern: systemctl disable --now koffer-fertig-raus-update.timer"
  fi
  exit 0
fi

# ---------- 1. Programm des Servers (Git) ----------
old=$(git -C "$SRC" rev-parse HEAD) # die Version, die gerade läuft
# Stand des Kanals holen (nach "zurueck" geht es so auch wieder auf den Kanal)
case $KANAL in
  main)
    git -C "$SRC" checkout -q main 2>/dev/null || true
    git -C "$SRC" pull --ff-only -q
    ;;
  v*)
    git -C "$SRC" fetch -q origin "+refs/tags/$KANAL:refs/tags/$KANAL"
    git -C "$SRC" checkout -q --detach "refs/tags/$KANAL"
    ;;
  *)
    git -C "$SRC" fetch -q origin "+refs/heads/$KANAL:refs/remotes/origin/$KANAL"
    git -C "$SRC" checkout -q -B "$KANAL" "origin/$KANAL"
    ;;
esac
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
  echo "!! App ($KANAL) konnte nicht geladen werden – die bisherige bleibt in Betrieb." >&2
fi
[[ $KANAL == main ]] || echo "Kanal: $KANAL (zurück zur neuesten Fassung: update.sh kanal main)"

# ---------- Werkzeuge für Sicherungsziele (SMB, SSH/rsync) und SSH-Schlüssel ----------
if [[ -z $R ]]; then # im Test (KFR_ROOT) nicht
missing=()
command -v rsync >/dev/null || missing+=(rsync)
command -v smbclient >/dev/null || missing+=(smbclient)
command -v ssh >/dev/null || missing+=(openssh-client)
if ((${#missing[@]})); then
  if apt-get install -y -qq --no-install-recommends "${missing[@]}" >/dev/null 2>&1 || { apt-get update -qq >/dev/null 2>&1 && apt-get install -y -qq --no-install-recommends "${missing[@]}" >/dev/null 2>&1; }; then
    echo "Werkzeuge für Sicherungsziele installiert: ${missing[*]}"
  else
    echo "!! Konnte ${missing[*]} nicht installieren – SMB/SSH-Ziele gehen erst danach." >&2
  fi
fi
if [[ ! -f /etc/koffer-fertig-raus/backup_ed25519 ]] && command -v ssh-keygen >/dev/null; then
  install -d -m 700 /etc/koffer-fertig-raus
  ssh-keygen -q -t ed25519 -N '' -C "koffer-fertig-raus-sicherung@$(hostname)" -f /etc/koffer-fertig-raus/backup_ed25519
  echo "SSH-Schlüssel für Sicherungen erzeugt (öffentlicher Teil: in der App unter Server-Sicherung)."
fi
if [[ -f /etc/koffer-fertig-raus/backup_ed25519.pub && -d /var/lib/koffer-fertig-raus ]]; then
  install -d -m 700 /var/lib/koffer-fertig-raus/sicherung
  cp /etc/koffer-fertig-raus/backup_ed25519.pub /var/lib/koffer-fertig-raus/sicherung/ssh.pub
  chown --reference=/var/lib/koffer-fertig-raus /var/lib/koffer-fertig-raus/sicherung /var/lib/koffer-fertig-raus/sicherung/ssh.pub
fi
if [[ -d /var/lib/koffer-fertig-raus/sicherung ]]; then
  touch /var/lib/koffer-fertig-raus/sicherung/eingerichtet # zeigt der App: Sicherung auf Anforderung ist eingerichtet
  chown --reference=/var/lib/koffer-fertig-raus /var/lib/koffer-fertig-raus/sicherung/eingerichtet
fi

# ---------- Werkzeug für Offline-Karten (pmtiles) ----------
PMTILES_VERSION=1.31.2
if ! /usr/local/bin/pmtiles version 2>/dev/null | grep -q "pmtiles $PMTILES_VERSION"; then
  case $(uname -m) in
    x86_64) arch=x86_64 ;;
    aarch64 | arm64) arch=arm64 ;;
    *) arch="" ;;
  esac
  url="https://github.com/protomaps/go-pmtiles/releases/download/v$PMTILES_VERSION/go-pmtiles_${PMTILES_VERSION}_Linux_$arch.tar.gz"
  if [[ -n $arch ]] && curl -fsSL "$url" -o "$tmp/pmtiles.tgz" && tar -xzf "$tmp/pmtiles.tgz" -C "$tmp" pmtiles; then
    install -m 755 "$tmp/pmtiles" /usr/local/bin/pmtiles
    echo "Werkzeug für Offline-Karten installiert (pmtiles $PMTILES_VERSION)."
    if [[ $old == "$new" ]]; then systemctl restart koffer-fertig-raus-sync; fi # damit der Server es erkennt
  else
    echo "!! pmtiles konnte nicht installiert werden – Offline-Karten bleiben aus." >&2
  fi
fi
fi # Ende: nicht im Test

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
    if ! after_rename "$old"; then
      echo "!! Server startet mit ${new:0:7} nicht. Zurück auf ${old:0:7} geht nicht (Stand von vor der Umbenennung) – bitte: journalctl -u koffer-fertig-raus-sync -n 50" >&2
      exit 1
    fi
    echo "!! Server startet mit ${new:0:7} nicht – gehe zurück auf ${old:0:7}." >&2
    git -C "$SRC" checkout -q --detach "$old"
    install_units
    if restart_server; then
      echo "Server läuft wieder mit ${old:0:7}. Fehlerbericht: journalctl -u koffer-fertig-raus-sync -n 50" >&2
    else
      echo "!! Server startet auch mit ${old:0:7} nicht – bitte: journalctl -u koffer-fertig-raus-sync -n 50" >&2
    fi
    exit 1
  fi
else
  install_units
fi
