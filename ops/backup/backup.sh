#!/bin/sh
# Egy mentés: az élő adatbázisról konzisztens másolat (WAL mellett is biztonságos), ellenőrzés,
# tömörítés, a feltöltött fájlok archívuma, majd a régi mentések törlése.
set -eu

DB="${DATABASE_FILE:-/data/taskflow.db}"
UPLOADS="${UPLOAD_DIR:-/data/uploads}"
OUT="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M%S)"

mkdir -p "$OUT"
TMP="$OUT/.taskflow-$STAMP.db"
trap 'rm -f "$TMP"' EXIT

sqlite3 "$DB" ".backup '$TMP'"
# Sérült mentést nem tartunk meg.
[ "$(sqlite3 "$TMP" 'PRAGMA integrity_check;')" = "ok" ] || { echo "backup integrity check FAILED" >&2; exit 1; }
gzip -c "$TMP" > "$OUT/taskflow-$STAMP.db.gz"

if [ -d "$UPLOADS" ] && [ -n "$(ls -A "$UPLOADS" 2>/dev/null)" ]; then
  tar -czf "$OUT/uploads-$STAMP.tar.gz" -C "$(dirname "$UPLOADS")" "$(basename "$UPLOADS")"
fi

find "$OUT" -maxdepth 1 -type f \( -name 'taskflow-*.db.gz' -o -name 'uploads-*.tar.gz' \) -mtime "+$KEEP_DAYS" -delete
echo "backup ok: taskflow-$STAMP.db.gz"
