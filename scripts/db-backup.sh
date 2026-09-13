#!/usr/bin/env bash
# Production sunucusunda cron ile periyodik çalıştırılır.
# `db` container'ının içindeki pg_dump ile yedek alır (sunucu ile birebir
# aynı sürüm garantisi), yedeği ./backups altına gzip'li olarak yazar ve
# admin panelinden ayarlanan saklama süresinden (BackupSettings.retention_days)
# eski yedekleri siler.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

set -a
# shellcheck disable=SC1091
source .env
set +a

BACKUP_DIR="$REPO_DIR/backups"
mkdir -p "$BACKUP_DIR"

LOCK_FILE="/tmp/libs-backup.lock"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "$(date '+%F %T') Önceki yedekleme hâlâ çalışıyor, çıkılıyor."
  exit 0
fi

TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"
TMP_FILE="${FILE}.tmp"

echo "$(date '+%F %T') Yedek alınıyor: $FILE"
docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$TMP_FILE"
mv "$TMP_FILE" "$FILE"

RETENTION_DAYS="$(docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT retention_days FROM \"BackupSettings\" ORDER BY id ASC LIMIT 1;" 2>/dev/null | tr -d '[:space:]')"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

echo "$(date '+%F %T') Saklama süresi: ${RETENTION_DAYS} gün, süresi geçen yedekler siliniyor..."
find "$BACKUP_DIR" -name "*.sql.gz" -mtime "+${RETENTION_DAYS}" -print -delete

echo "$(date '+%F %T') Yedekleme tamamlandı."
