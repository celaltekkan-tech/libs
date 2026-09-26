#!/usr/bin/env bash
# İsteğe bağlı host-tarafı yedek. Asıl zamanlama ve geri yükleme uygulama
# içinden (Platform Yönetimi → Yedekleme) yapılır. Uygulama içi zamanlayıcı
# açıksa (BACKUP_CRON_ENABLED != false) bu script çift yedek almamak için
# hiçbir şey yapmadan çıkar. Her çalışma "BackupLogs" tablosuna da yazılır ve
# panelde Yedekleme Geçmişi'nde görünür.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

set -a
# shellcheck disable=SC1091
source .env
set +a

BACKUP_DIR="${BACKUP_HOST_DIR:-$REPO_DIR/backups}"
case "$BACKUP_DIR" in /*) ;; *) BACKUP_DIR="$REPO_DIR/${BACKUP_DIR#./}" ;; esac

log() { echo "$(date '+%F %T') $*"; }

# BackupLogs'a satır ekler; DB'ye ulaşılamazsa yalnızca dosya loguna yazılmış olur.
db_log() {
  local action="$1" status="$2" filename="$3" size="$4" message="$5"
  printf '%s\n' "INSERT INTO \"BackupLogs\" (action, trigger, status, filename, size_bytes, backup_dir, message, created_at, updated_at) VALUES (:'action', 'host', :'status', NULLIF(:'filename', ''), NULLIF(:'size', '')::bigint, :'dir', :'message', now(), now());" \
    | docker compose exec -T db psql -q -U "$DB_USER" -d "$DB_NAME" \
        -v action="$action" -v status="$status" -v filename="$filename" -v size="$size" \
        -v dir="$BACKUP_DIR" -v message="$message" >/dev/null 2>&1 || true
}

if [ "$(printf '%s' "${BACKUP_CRON_ENABLED:-true}" | tr '[:upper:]' '[:lower:]')" != "false" ]; then
  log "Uygulama içi yedek zamanlayıcısı açık (BACKUP_CRON_ENABLED != false); host yedeği atlandı."
  exit 0
fi

mkdir -p "$BACKUP_DIR"

LOCK_FILE="/tmp/libs-backup.lock"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "Önceki yedekleme hâlâ çalışıyor, çıkılıyor."
  db_log backup skipped "" "" "Önceki host yedeği hâlâ çalıştığı için atlandı"
  exit 0
fi

TIMESTAMP="$(TZ=Europe/Istanbul date +%Y%m%d_%H%M%S)"
SAFE_DB="$(printf '%s' "$DB_NAME" | tr -c 'A-Za-z0-9_.-' '_')"
NAME="${SAFE_DB}_${TIMESTAMP}.sql.gz"
FILE="$BACKUP_DIR/$NAME"
TMP_FILE="${FILE}.host$$.tmp"
trap 'rm -f "$TMP_FILE"' EXIT

log "Yedek alınıyor: $FILE"
if ! docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl --clean --if-exists 2>"$TMP_FILE.err" | gzip > "$TMP_FILE"; then
  MSG="pg_dump başarısız: $(tail -c 1500 "$TMP_FILE.err" 2>/dev/null)"
  rm -f "$TMP_FILE.err"
  log "$MSG"
  db_log backup error "$NAME" "" "$MSG"
  exit 1
fi
rm -f "$TMP_FILE.err"
SIZE="$(stat -c %s "$TMP_FILE")"
if [ "$SIZE" -lt 50 ]; then
  log "Yedek dosyası boş oluştu ($SIZE bayt)."
  db_log backup error "$NAME" "$SIZE" "Yedek dosyası boş oluştu"
  exit 1
fi
mv "$TMP_FILE" "$FILE"
db_log backup success "$NAME" "$SIZE" "Host cron yedeği alındı: $NAME"

RETENTION_DAYS="$(docker compose exec -T db psql -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT retention_days FROM \"BackupSettings\" ORDER BY id ASC LIMIT 1;" 2>/dev/null | tr -d '[:space:]' || true)"
case "$RETENTION_DAYS" in ''|*[!0-9]*) RETENTION_DAYS=30 ;; esac
[ "$RETENTION_DAYS" -lt 1 ] && RETENTION_DAYS=1

# Yalnızca zamanlanmış yedek adları (<db>_YYYYMMDD_HHMMSS.sql.gz) temizlenir; en yeni 3 tanesi her zaman kalır.
log "Saklama süresi: ${RETENTION_DAYS} gün, süresi geçen zamanlanmış yedekler siliniyor..."
find "$BACKUP_DIR" -maxdepth 1 -type f -regextype posix-extended \
  -regex ".*/${SAFE_DB//./\\.}_[0-9]{8}_[0-9]{6}\.sql\.gz" -printf '%T@ %f\n' \
  | sort -rn | tail -n +4 | while read -r MTIME OLD; do
      if [ "${MTIME%.*}" -lt "$(( $(date +%s) - RETENTION_DAYS * 86400 ))" ]; then
        rm -f "$BACKUP_DIR/$OLD" && log "Silindi: $OLD" \
          && db_log prune success "$OLD" "" "Saklama süresi (${RETENTION_DAYS} gün) aşıldığı için host script tarafından silindi"
      fi
    done

log "Yedekleme tamamlandı."
