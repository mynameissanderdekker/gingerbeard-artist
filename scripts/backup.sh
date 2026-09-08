#!/usr/bin/env bash
# Volledige export van een Sanity-dataset — documenten én foto's — naar
# ~/websites/clients/<klant>/backup/<klant>-<datum>.tar.gz
#
#   bash scripts/backup.sh torch-gallery                # dataset production
#   bash scripts/backup.sh brinkman-bergsma tenanttest  # andere dataset
#
# Waarom: de inhoud van een galerie (werken, contacten, orders, 1782 foto's bij
# Torch) staat bij Sanity en nergens anders. De code staat op GitHub, dat is
# dubbel; de inhoud was enkel. Dit maakt hem dubbel.
#
# Bewaart de laatste 6 exports per klant; oudere gaan weg.
# Terugzetten (alleen met opzet, en eerst een verse export maken):
#   npx sanity dataset import <bestand>.tar.gz production --replace

set -euo pipefail

KLANT="${1:-}"
DATASET="${2:-production}"
[ -z "$KLANT" ] && { echo "gebruik: bash scripts/backup.sh <klant> [dataset]"; exit 1; }

HIER="$(cd "$(dirname "$0")/.." && pwd)"
DOEL="$HIER/../clients/$KLANT/backup"
mkdir -p "$DOEL"

BESTAND="$DOEL/$KLANT-$DATASET-$(date +%F).tar.gz"
echo "→ export $DATASET → $BESTAND"
(cd "$HIER" && npx sanity dataset export "$DATASET" "$BESTAND" --overwrite)

echo "→ controle"
# Aantal documenten in de export (data.ndjson binnenin) en de grootte.
DOCS=$(tar -xzOf "$BESTAND" --wildcards '*/data.ndjson' 2>/dev/null | wc -l | tr -d ' ')
GROOTTE=$(du -h "$BESTAND" | cut -f1)
FOTOS=$(tar -tzf "$BESTAND" | grep -c '/images/' || true)
# Let op: foto's tellen hier níet als documenten (dat doen ze in een losse
# ndjson-export wel) — ze staan als bestanden in images/. Torch, 5 sept 2026:
# 3000 documenten + 1782 foto's = compleet.
echo "  $DOCS documenten, $FOTOS foto's, $GROOTTE"
[ "$DOCS" -gt 0 ] || { echo "✗ export bevat geen documenten"; exit 1; }
[ "$FOTOS" -gt 0 ] || echo "  ! geen foto's in de export — heeft deze dataset er wel?"

# Opruimen: laatste 6 bewaren.
ls -1t "$DOEL"/"$KLANT"-"$DATASET"-*.tar.gz 2>/dev/null | tail -n +7 | while read -r oud; do
  echo "  weg: $(basename "$oud")"; rm -f "$oud"
done

echo "✓ klaar — $(ls -1 "$DOEL" | wc -l | tr -d ' ') bestand(en) in clients/$KLANT/backup/"
