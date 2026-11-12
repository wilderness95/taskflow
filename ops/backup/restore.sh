#!/bin/sh
# Visszaállítás egy mentésből. Használat (a repó gyökeréből, a stack leállítva):
#   docker compose stop api web
#   ops/backup/restore.sh backups/taskflow-20260101-030000.db.gz [backups/uploads-20260101-030000.tar.gz]
#   docker compose start api web
set -eu
[ $# -ge 1 ] || { echo "usage: $0 <taskflow-*.db.gz> [uploads-*.tar.gz]" >&2; exit 2; }
DATA="${DATA_DIR:-./data}"
mkdir -p "$DATA"

if [ -f "$DATA/taskflow.db" ]; then
  mv "$DATA/taskflow.db" "$DATA/taskflow.db.before-restore.$(date +%Y%m%d-%H%M%S)"
fi
# A régi WAL/SHM fájlok nem illenek az új adatbázishoz.
rm -f "$DATA/taskflow.db-wal" "$DATA/taskflow.db-shm"
gzip -dc "$1" > "$DATA/taskflow.db"

if [ $# -ge 2 ]; then
  [ -d "$DATA/uploads" ] && mv "$DATA/uploads" "$DATA/uploads.before-restore.$(date +%Y%m%d-%H%M%S)"
  tar -xzf "$2" -C "$DATA"
fi
echo "restored; verify with: sqlite3 $DATA/taskflow.db 'PRAGMA integrity_check;'"
