#!/bin/sh
# A mentést indulás után azonnal, majd naponta BACKUP_HOUR órakor (a TZ időzónájában) futtatja.
set -eu
HOUR="${BACKUP_HOUR:-3}"

backup() { /usr/local/bin/backup.sh || echo "backup failed" >&2; }

# Az első indításkor, ha még nincs mentés, azonnal készül egy.
ls /backups/taskflow-*.db.gz >/dev/null 2>&1 || backup

while true; do
  now="$(date +%s)"
  next="$(date -d "$(date +%Y-%m-%d) $(printf '%02d' "$HOUR"):00:00" +%s)"
  [ "$next" -le "$now" ] && next=$((next + 86400))
  echo "next backup in $((next - now)) seconds"
  sleep "$((next - now))"
  backup
done
