#!/usr/bin/env bash
# Production sunucusunda cron ile periyodik çalıştırılır.
# origin/$BRANCH'te yeni commit varsa fast-forward pull yapıp container'ları
# yeniden build eder. Migration'lar backend'in kendi entrypoint'i tarafından
# (docker/backend-entrypoint.sh) container her başladığında otomatik çalışır.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRANCH="${DEPLOY_BRANCH:-master}"
LOCK_FILE="/tmp/libs-deploy.lock"

exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "$(date '+%F %T') Önceki deploy hâlâ çalışıyor, çıkılıyor."
  exit 0
fi

cd "$REPO_DIR"

git fetch origin "$BRANCH" --quiet

LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"

if [ "$LOCAL" = "$REMOTE" ]; then
  exit 0
fi

echo "$(date '+%F %T') Yeni commit bulundu ($LOCAL -> $REMOTE), güncelleniyor..."

git merge --ff-only "origin/$BRANCH"

docker compose up -d --build

docker image prune -f >/dev/null 2>&1 || true

echo "$(date '+%F %T') Güncelleme tamamlandı (${REMOTE})."
