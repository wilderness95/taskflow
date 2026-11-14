#!/usr/bin/env bash
# Biztonságos telepítés: mentés -> build és indítás -> readiness-ellenőrzés -> hibánál visszaállás.
#
# Használat a repó gyökeréből (előtte: git pull, .env kitöltve):
#   ops/deploy.sh [--timeout=MÁSODPERC] [--skip-backup] [--no-db-restore]
#
# Lépések:
#   1. Ha a stack fut: konzisztens mentés (`backup.sh`), a futó image-ek megjegyzése (`<image>:previous`).
#   2. `docker compose up -d --build`.
#   3. Várakozás: az `api` /readyz-e és a `web` -> `api` útvonal (/healthz az nginxen át) rendben van-e,
#      és nincs `unhealthy` vagy újraindulási hurokban lévő szolgáltatás.
#   4. Hiba esetén: az előző image-ek visszaállítása. Ha az új verzió migrációt futtatott (az adatbázis
#      sémája előre ment, a régi kód nem biztos, hogy elfut vele), az adatbázis a telepítés előtti mentésből
#      áll vissza; a telepítés óta írt adat ekkor elvész (`--no-db-restore`: ezt kihagyja, a mentés megmarad).
#
# Kilépési kód: 0 siker; 1 hibás telepítés, de a visszaállás sikerült; 2 a visszaállás is hibás (kézi beavatkozás kell).
set -euo pipefail

TIMEOUT=180
SKIP_BACKUP=0
DB_RESTORE=1
for arg in "$@"; do
  case "$arg" in
    --timeout=*) TIMEOUT="${arg#*=}" ;;
    --skip-backup) SKIP_BACKUP=1 ;;
    --no-db-restore) DB_RESTORE=0 ;;
    -h | --help) sed -n '2,17p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "ismeretlen kapcsoló: $arg" >&2; exit 64 ;;
  esac
done

cd "$(dirname "$0")/.."
SERVICES=(api web backup)
STATE="$(mktemp -d)"
trap 'rm -rf "$STATE"' EXIT

log() { printf '[deploy %s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { log "HIBA: $*" >&2; exit 1; }

[ -f .env ] || die "hiányzik a .env (cp .env.example .env, majd töltsd ki)"
docker compose version >/dev/null 2>&1 || die "a docker compose nem érhető el"
REV="$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
log "telepítés indul: $REV ($(git symbolic-ref --short -q HEAD 2>/dev/null || echo detached))"

# A szolgáltatás futó konténere; üres, ha nem fut.
container() { docker compose ps -q "$1" 2>/dev/null | head -n1; }

# Az adatbázis lefuttatott migrációinak száma (a backup konténer sqlite3-ával; üres, ha nem olvasható).
migration_count() {
  docker compose run --rm --no-deps -T --entrypoint sqlite3 backup /data/taskflow.db \
    'select count(*) from __drizzle_migrations;' 2>/dev/null | tr -d '[:space:]' || true
}

# Az api readiness-e és a web -> api útvonal; mindkettő a konténeren belülről (nincs portkiengedés).
ready_once() {
  docker compose exec -T api node -e \
    "fetch('http://localhost:3000/readyz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))" \
    >/dev/null 2>&1 || return 1
  docker compose exec -T web wget -q -O /dev/null http://127.0.0.1/healthz >/dev/null 2>&1 || return 1
  # Nincs hibás vagy újraindulási hurokban lévő szolgáltatás.
  if docker compose ps --format '{{.Service}} {{.State}} {{.Health}}' 2>/dev/null |
    grep -E ' (restarting|exited|dead)( |$)| unhealthy$' >/dev/null; then
    return 1
  fi
  return 0
}

wait_ready() {
  local deadline=$((SECONDS + TIMEOUT))
  while [ "$SECONDS" -lt "$deadline" ]; do
    if ready_once; then return 0; fi
    sleep 3
  done
  return 1
}

# --- 1. előkészítés ---------------------------------------------------------------------------
RUNNING=0
[ -n "$(container api)" ] && RUNNING=1
BACKUP_FILE=""
MIGRATIONS_BEFORE=""

if [ "$RUNNING" -eq 1 ]; then
  log "a stack fut: a visszaállási pont előkészítése"
  for svc in "${SERVICES[@]}"; do
    cid="$(container "$svc")"
    [ -n "$cid" ] || continue
    name="$(docker inspect -f '{{.Config.Image}}' "$cid")"
    id="$(docker inspect -f '{{.Image}}' "$cid")"
    [ -n "$name" ] && [ -n "$id" ] || die "a(z) $svc futó image-e nem állapítható meg, a telepítés megszakítva (a stack változatlan)"
    printf '%s %s\n' "$name" "$id" >"$STATE/$svc"
    docker tag "$id" "${name%%:*}:previous"
  done
  MIGRATIONS_BEFORE="$(migration_count)"
  if [ "$SKIP_BACKUP" -eq 0 ]; then
    log "adatbázis-mentés"
    out="$(docker compose run --rm --no-deps -T --entrypoint /usr/local/bin/backup.sh backup)" ||
      die "a mentés nem sikerült, a telepítés megszakítva (a stack változatlan)"
    echo "$out"
    BACKUP_FILE="$(printf '%s\n' "$out" | sed -n 's/^backup ok: //p' | tail -n1)"
    [ -n "$BACKUP_FILE" ] || die "a mentés fájlneve ismeretlen, a telepítés megszakítva"
    log "mentés kész: backups/$BACKUP_FILE"
  else
    log "FIGYELEM: --skip-backup, nincs telepítés előtti mentés"
  fi
else
  log "a stack nem fut (első telepítés): mentés és visszaállási pont kihagyva"
fi

# --- 2-3. build, indítás, ellenőrzés ----------------------------------------------------------
rollback() {
  log "VISSZAÁLLÁS az előző verzióra"
  local svc name id
  for svc in "${SERVICES[@]}"; do
    [ -f "$STATE/$svc" ] || continue
    read -r name id <"$STATE/$svc"
    docker tag "$id" "${name%%:*}:latest"
  done
  docker compose stop api web backup >/dev/null 2>&1 || true

  local after
  after="$(migration_count)"
  if [ -n "$MIGRATIONS_BEFORE" ] && [ -n "$after" ] && [ "$after" != "$MIGRATIONS_BEFORE" ]; then
    if [ "$DB_RESTORE" -eq 1 ] && [ -n "$BACKUP_FILE" ]; then
      log "az új verzió migrált ($MIGRATIONS_BEFORE -> $after): az adatbázis visszaállítása a mentésből"
      log "FIGYELEM: a telepítés óta írt adat elvész; a hibás adatbázis taskflow.db.before-restore.* néven megmarad"
      local stamp="${BACKUP_FILE#taskflow-}"
      stamp="${stamp%.db.gz}"
      local uploads="backups/uploads-$stamp.tar.gz"
      if [ -f "$uploads" ]; then
        ops/backup/restore.sh "backups/$BACKUP_FILE" "$uploads" || return 1
      else
        ops/backup/restore.sh "backups/$BACKUP_FILE" || return 1
      fi
    else
      log "FIGYELEM: az új verzió migrált ($MIGRATIONS_BEFORE -> $after), de az adatbázis nem áll vissza"
      log "(--no-db-restore vagy nincs mentés); a régi kód az új sémával nem biztos, hogy elindul"
    fi
  fi
  docker compose up -d --no-build --remove-orphans || return 1
  wait_ready
}

# Első telepítésnél nincs mire visszaállni: a hiba után a stack marad, a naplók a hibakereséshez.
first_deploy_failed() {
  log "a telepítés sikertelen, nincs előző verzió (első telepítés); naplók: docker compose logs --tail=100"
  exit 1
}

log "build és indítás"
if ! docker compose up -d --build --remove-orphans; then
  log "a build vagy az indítás nem sikerült"
  [ "$RUNNING" -eq 1 ] || first_deploy_failed
  if rollback; then log "visszaállítva az előző verzióra; a telepítés sikertelen"; exit 1; fi
  log "A VISSZAÁLLÍTÁS IS SIKERTELEN: kézi beavatkozás kell"
  [ -n "$BACKUP_FILE" ] && log "mentés: backups/$BACKUP_FILE (visszaállítás: docs/OPERATIONS.md)"
  exit 2
fi

log "várakozás a készenlétre (legfeljebb ${TIMEOUT} mp)"
if wait_ready; then
  log "a telepítés sikeres ($REV)"
  docker compose ps
  exit 0
fi

log "az új verzió nem lett kész időben"
docker compose logs --tail=40 api 2>&1 | sed 's/^/  api| /' || true
[ "$RUNNING" -eq 1 ] || first_deploy_failed
if rollback; then
  log "visszaállítva az előző verzióra; a telepítés sikertelen ($REV)"
  exit 1
fi
log "A VISSZAÁLLÍTÁS IS SIKERTELEN: kézi beavatkozás kell"
[ -n "$BACKUP_FILE" ] && log "mentés: backups/$BACKUP_FILE (visszaállítás: docs/OPERATIONS.md)"
exit 2
