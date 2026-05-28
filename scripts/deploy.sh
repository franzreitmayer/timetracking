#!/bin/bash
# Normaler Deploy: Code holen, Images bauen, Container neu starten.
# Migrationen werden automatisch beim Backend-Start eingespielt.
#
# Verwendung:
#   ./scripts/deploy.sh            # baut und startet backend + frontend
#   ./scripts/deploy.sh frontend   # baut und startet nur das frontend

set -e

SERVICES=${*:-backend frontend}

echo "=== Pulling latest code ==="
git pull origin main

echo "=== Building & restarting: $SERVICES ==="
docker compose up -d --build $SERVICES

echo "=== Status ==="
docker compose ps

echo "=== Backend-Log (letzte 20 Zeilen) ==="
sleep 3
docker compose logs --tail=20 backend
