#!/usr/bin/env bash
# KofferFertigRaus – Container für den Abgleich-Server auf dem Proxmox-HOST anlegen und einrichten.
#
# In der Proxmox-Oberfläche: Knoten auswählen → "Shell", dann:
#   curl -fsSL https://raw.githubusercontent.com/MrCatwiesel/KofferFertigRaus/main/server/proxmox/create-ct.sh -o create-ct.sh
#   bash create-ct.sh
#
# Fragt nach Container-Nummer, IP usw. (Enter übernimmt den Vorschlag in Klammern).
set -euo pipefail

RAW="https://raw.githubusercontent.com/MrCatwiesel/KofferFertigRaus/main/server/proxmox"
command -v pct >/dev/null || { echo "Dieses Skript läuft auf dem Proxmox-Host (pct fehlt)."; exit 1; }
[[ $EUID -eq 0 ]] || { echo "Bitte als root ausführen."; exit 1; }
say() { printf '\n\033[1;34m==> %s\033[0m\n' "$*"; }
ask() { local v; read -r -p "$1 [$2]: " v; echo "${v:-$2}"; }

CTID=$(ask "Container-Nummer" "$(pvesh get /cluster/nextid)")
NAME=$(ask "Name" "koffer-fertig-raus")
IP=""
while [[ ! $IP =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; do
  IP=$(ask "Feste IP im Heimnetz (frei, außerhalb des DHCP-Bereichs)" "192.168.178.50")
done
# Netzmaske: Zahl (24) oder Schreibweise 255.255.255.0 – beides wird angenommen
mask_to_cidr() {
  local m=$1 n=0 o
  [[ $m =~ ^[0-9]+$ ]] && { echo "$m"; return; }
  IFS=. read -r -a parts <<<"$m"
  for o in "${parts[@]}"; do
    case $o in 255) n=$((n+8));; 254) n=$((n+7));; 252) n=$((n+6));; 248) n=$((n+5));;
      240) n=$((n+4));; 224) n=$((n+3));; 192) n=$((n+2));; 128) n=$((n+1));; 0) ;; *) echo ""; return;; esac
  done
  echo "$n"
}
CIDR=""
while [[ ! $CIDR =~ ^[0-9]+$ ]] || (( CIDR < 8 || CIDR > 30 )); do
  CIDR=$(mask_to_cidr "$(ask "Netzmaske (24 oder 255.255.255.0)" "24")")
done
GW=""
while [[ ! $GW =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; do
  GW=$(ask "Gateway (Router)" "${IP%.*}.1")
done
echo "→ Netz: $IP/$CIDR, Gateway $GW"
BRIDGE=$(ask "Netzwerk-Bridge" "vmbr0")
STORAGE=$(ask "Speicher für die Festplatte" "local-lvm")
DISK=""
while [[ ! $DISK =~ ^[0-9]+$ ]] || (( DISK < 4 )); do
  DISK=$(ask "Festplattengröße in GB (Fotos aller Reisen, später vergrößerbar)" "32")
done
TSTORE=$(ask "Speicher für Vorlagen" "local")
read -r -s -p "Root-Passwort für den Container: " PW; echo
[[ ${#PW} -ge 8 ]] || { echo "Mindestens 8 Zeichen."; exit 1; }

say "Debian-Vorlage besorgen"
pveam update >/dev/null
TEMPLATE=$(pveam available --section system | awk '/debian-12-standard/ {print $2}' | sort -V | tail -1)
[[ -n $TEMPLATE ]] || { echo "Keine Debian-12-Vorlage gefunden."; exit 1; }
if ! pveam list "$TSTORE" | grep -q "$TEMPLATE"; then
  pveam download "$TSTORE" "$TEMPLATE"
fi

say "Container $CTID ($NAME, $IP) anlegen"
pct create "$CTID" "$TSTORE:vztmpl/$TEMPLATE" \
  --hostname "$NAME" \
  --cores 1 --memory 512 --swap 512 \
  --rootfs "$STORAGE:$DISK" \
  --net0 "name=eth0,bridge=$BRIDGE,ip=$IP/$CIDR,gw=$GW" \
  --nameserver "$GW" \
  --unprivileged 1 \
  --features nesting=1 \
  --onboot 1 \
  --password "$PW" \
  --description "KofferFertigRaus – Abgleich-Server – https://github.com/MrCatwiesel/KofferFertigRaus"
pct start "$CTID"

say "Warten auf Netzwerk im Container"
for _ in $(seq 1 30); do
  pct exec "$CTID" -- getent hosts deb.debian.org >/dev/null 2>&1 && break
  sleep 2
done

say "Einrichtung im Container"
pct exec "$CTID" -- bash -c "apt-get update -qq && apt-get install -y -qq curl >/dev/null"
pct exec "$CTID" -- bash -c "curl -fsSL $RAW/install.sh -o /root/install.sh && bash /root/install.sh"

say "Fertig – Container $CTID läuft und startet mit Proxmox automatisch."
echo "Tipp: Container in die geplante Sicherung aufnehmen (Datacenter → Backup)."
