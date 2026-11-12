# syntax=docker/dockerfile:1
# Napi SQLite-mentés sidecar: konzisztens pillanatkép (`.backup`), tömörítés, ellenőrzés, rotáció.
FROM alpine:3.21
RUN apk add --no-cache sqlite tar gzip tzdata
COPY ops/backup/backup.sh ops/backup/entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/backup.sh /usr/local/bin/entrypoint.sh
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
