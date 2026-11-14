# Üzemeltetés

Docker Compose (`api`, `web`, `backup`, `cloudflared`) a házi szerveren. Indítás: `cp .env.example .env`, kitöltés,
majd `ops/deploy.sh` (az első indításnál ugyanez, lásd a *Telepítés és visszaállás* részt). Az összes szolgáltatás `restart: unless-stopped`, a logok rotálnak
(`json-file`, 3 x 10 MB), az `api` és a `web` healthchecket kapott (`docker compose ps` mutatja).

## Hangasszisztens beállítása

A `.env`-ben a `GEMINI_API_KEY` (https://aistudio.google.com) kell; nélküle a mikrofon gomb el sem jelenik
(`GET /api/v1/health` -> `voice: false`), a `WS /api/v1/voice/live` 503 `voice_unavailable`. A kulcs csak az `api`
konténerben él. A költség korlátozása: `VOICE_MAX_SESSIONS_PER_USER` (alap: 2) és `VOICE_MAX_MINUTES` (alap: 15).

## Hangasszisztens-statisztika

Minden lezárt hangmunkamenetről egyetlen összesítő sor készül (`voice_sessions`): kezdet, hossz, a lezárás oka
(`client_closed`, `session_expired`, `upstream_error`, `upstream_closed`), a félbeszakítások, az eszközhívások és a hibás
eszközhívások száma, valamint a modellnek küldött és tőle kapott hang hossza (a nyers PCM méretéből). Hang, átirat és
bármilyen felhasználói tartalom nem tárolódik. A platform-admin az `/admin` áttekintőben látja (utolsó 7, 30 vagy 90 nap),
API-n: `GET /api/v1/admin/voice-stats?days=30`. A küldött és kapott hang hossza a Gemini Live számlázásának
közelítő alapja: ebből becsülhető a költség. Az `upstream_error` arány növekedése a Gemini oldali vagy hálózati gondra utal.

## Napi mentés

A `backup` sidecar indulás után azonnal, majd naponta `BACKUP_HOUR` órakor (`TZ` időzóna) ment a `./backups` mappába:

- `taskflow-<időbélyeg>.db.gz`: az SQLite `.backup` pillanatképe (az élő, WAL-módú adatbázisról is konzisztens),
  tömörítés előtt `PRAGMA integrity_check`; sérült mentés nem marad meg;
- `uploads-<időbélyeg>.tar.gz`: a feltöltött csatolmányok;
- a `BACKUP_KEEP_DAYS` napnál régebbi mentések törlődnek (alap: 14).

**A mentés a szerveren belül marad**, ezért a `./backups` mappát ki kell vinni másik gépre vagy felhőbe is
(pl. `rsync -a ./backups/ user@masik-gep:/mentesek/taskflow/` cronból, vagy `rclone sync ./backups remote:taskflow`).
Opcionálisan a Litestream is használható folyamatos replikációra; a jelenlegi sidecar ennél egyszerűbb, napi pontosságú.

### Visszaállítás (és a próbája)

```sh
docker compose stop api web backup
ops/backup/restore.sh backups/taskflow-20261112-030000.db.gz backups/uploads-20261112-030000.tar.gz
docker compose up -d
```

A szkript a jelenlegi adatbázist `taskflow.db.before-restore.<időbélyeg>` néven megőrzi, a régi WAL/SHM fájlokat törli,
és kicsomagolja a mentést (a második argumentum, a csatolmány-archívum elhagyható). Ellenőrzés:
`sqlite3 data/taskflow.db 'PRAGMA integrity_check;'`, majd belépés és egy tábla megnyitása.

**Próba:** negyedévente (és az első élesítéskor) futtasd egy másolaton: `DATA_DIR=/tmp/restore-test ops/backup/restore.sh
<mentés>`, majd nyisd meg az eredmény adatbázist (`sqlite3 ... 'select count(*) from cards'`). A mentés és a
visszaállítás kézi lefutása Alpine alatt az M7-ben ellenőrizve lett.

## Telepítés és visszaállás

Frissítéshez ne a kézi `docker compose up -d --build`-ot használd, hanem a telepítő szkriptet:

```sh
git pull
ops/deploy.sh                 # --timeout=MÁSODPERC (alap 180), --skip-backup, --no-db-restore
```

A szkript lépései:

1. Ha a stack fut: konzisztens adatbázis-mentés a `backup` sidecar `backup.sh`-jával (a fájlok is), és a futó image-ek
   megjegyzése (`<image>:previous`). Ha a mentés nem sikerül, a telepítés **nem indul el**, és a stack változatlan marad.
2. `docker compose up -d --build`.
3. Várakozás a készenlétre: az `api` `/readyz`-e, a `web` -> `api` útvonal (`/healthz` az nginxen át), és hogy egy
   szolgáltatás sem `unhealthy` vagy újraindulási hurokban.
4. Hiba (build, indítás vagy időtúllépés) esetén visszaállás: a régi image-ek visszakerülnek, a stack újraindul.
   Ha az új verzió **migrációt futtatott**, az adatbázis séma előre ment, és a régi kód nem biztos, hogy elfut vele; ekkor az
   adatbázis (és a csatolmányok) a telepítés előtti mentésből áll vissza. **A telepítés óta írt adat ilyenkor elvész**; a hibás
   adatbázis `data/taskflow.db.before-restore.<időbélyeg>` néven megmarad. A `--no-db-restore` ezt kihagyja (csak az image-ek
   állnak vissza, a mentés a `backups/` mappában marad).

Kilépési kód: `0` siker; `1` hibás telepítés, de a visszaállás sikerült (a rendszer a régi verzión fut); `2` a visszaállás is
hibás, kézi beavatkozás kell (a szkript kiírja a mentés nevét; lásd a visszaállítást fent). Első telepítésnél (nem fut a stack)
nincs mentés és visszaállási pont; hibánál a naplók a hibakereséshez maradnak (`docker compose logs --tail=100`).

Tanácsok: a kényes (migrációs) frissítést csendes időben telepítsd; az `api` naplójában a `reqId`-vel kereshetsz
(lásd a naplókról szóló részt). A telepítés mellékhatása, hogy a pre-deploy mentés is a szokásos rotációba (`BACKUP_KEEP_DAYS`) kerül.

## Állapot, naplók és monitorozás

### Health végpontok

| Végpont | Mit jelent | Hibánál |
|---|---|---|
| `GET /healthz` | liveness: a folyamat válaszol (`{"status":"ok"}`), függőséget nem ellenőriz | nincs válasz: a folyamat áll |
| `GET /readyz` | readiness: `database`, `migrations`, `storage` (a feltöltési könyvtár írható) | `503`, a hibás ellenőrzés neve a törzsben |
| `GET /api/v1/health` | a frontend állapotlekérdezése (`voice`, `registrationOpen`...), nem monitorozásra való | |

A három végpont névtelen. A `/healthz` és `/readyz` nem esik a rate limit alá, és nem naplózódik; titkot nem ad ki. Az nginx
(`apps/web/nginx.conf`) csak ezt a kettőt adja tovább a nyilvános domainről. A Docker healthcheck a `/healthz`-t használja,
hogy egy átmeneti adatbázishiba ne indítsa újra a konténert; a `/readyz` a külső monitornak és a hibakereséshez való.

A `docker compose ps` mutatja az egészségi állapotot mind a négy szolgáltatásra: `api`, `web`, `cloudflared` (`tunnel ready`)
és `backup` (van-e 26 óránál frissebb mentés). Az admin áttekintő (`/admin`) is mutatja az adatbázis állapotát és a
legutóbbi mentés idejét (az `api` a `./backups` mappát csak olvasásra látja, `BACKUP_DIR`).

A `restart: unless-stopped` csak a leállt konténert indítja újra, az `unhealthy` állapotút nem. Ha ez is kell, egy
`autoheal` konténer (Docker socket kell hozzá, ezért biztonsági mérlegelés tárgya) vagy külső riasztás és kézi `docker compose restart <szolgáltatás>`.

### Naplók

A napló soronként JSON (`docker compose logs api`). Minden kéréshez tartozó sor tartalmazza a `reqId`-t, a bejelentkezett
szereplő esetén az `actorId`-t és `actorType`-ot (`user` vagy `api_key`). A válasz `x-request-id` fejléce ugyanez az érték, a `500`-as
hiba törzse (`error.details.requestId`) is ezt hordozza: a felhasználó által jelzett hiba így megkereshető:

```sh
docker compose logs api | grep '"reqId":"<azonosító>"'
```

- A `LOG_LEVEL` szabályozza a szintet (alap: `info`).
- Az ennél lassabb kérés (`SLOW_REQUEST_MS`, alap 1000 ms) `warn` szinten, `slow request` üzenettel és `route`-tal naplózódik.
- Redakció: az `Authorization`, `Cookie`, `Set-Cookie`, `Idempotency-Key` fejléc és a `password`, `token`, `secret` stb. mezők
  sosem kerülnek a naplóba. Új titkot hordozó mezőnél bővítsd a `LOG_REDACT_PATHS`-t (`plugins/requestLogging.ts`).

### Külső uptime-monitor

A monitornak **nem a házi szerveren** kell futnia (különben a szerverrel együtt áll le), és a nyilvános domainen át kell
ellenőriznie, így a Cloudflare Tunnelt és az nginxet is lefedi. Ajánlott: egy másik gépen futó Uptime Kuma, vagy egy
hosztolt szolgáltatás ingyenes csomagja (UptimeRobot, Better Stack, Healthchecks.io).

| Ellenőrzés | URL | Elvárás | Gyakoriság |
|---|---|---|---|
| Elérhetőség | `https://<domain>/healthz` | HTTP 200 és a törzsben `"status":"ok"` | 1 perc |
| Készenlét | `https://<domain>/readyz` | HTTP 200 | 5 perc |
| Tanúsítvány | `https://<domain>` | lejárat > 14 nap | napi |

Riasztás: két egymás utáni hibás ellenőrzés után e-mailben vagy Telegramon. Ha `/healthz` hibás, de a szerver él, a
`cloudflared` konténert vizsgáld (`docker compose ps`, `docker compose logs cloudflared`); ha csak a `/readyz` hibás, a
válasz törzse megmondja, melyik ellenőrzés bukott.

## WebSocket és SSE a Cloudflare Tunnelen és az nginx-en

- Az nginx (`apps/web/nginx.conf`) az `Upgrade` fejlécet továbbadja (`map $http_upgrade $connection_upgrade`), a
  `proxy_read_timeout`/`proxy_send_timeout` 1 óra, a puffer ki van kapcsolva (SSE).
- A Cloudflare a WebSocketet alapból átengedi (Tunnel mögött is), de az üresen álló kapcsolatot ~100 másodperc után
  bontja: az API ezért 25 másodpercenként WebSocket pinget küld a hangmunkamenetre, az SSE-re pedig `: ping` sort.
- **Éles ellenőrzés** (a Tunnel és a domain beállítása után, a deploy része):
  1. nyiss egy táblát, kapcsold be a mikrofont: az állapotjelző `Hallgatlak`-ra vált (a `ready` üzenet átért);
  2. hagyd 3 percig csendben bekapcsolva: a kapcsolat nem szakadhat meg (ping/keepalive);
  3. `docker compose logs web` ne mutasson 101-től eltérő státuszt a `/api/v1/voice/live` kéréseken;
  4. ha 400/426 jön: a Cloudflare dashboardon (Network) a WebSockets kapcsoló legyen bekapcsolva.
- A hangmunkamenet legfeljebb `VOICE_MAX_MINUTES` percig tart, utána `session_expired`.

## Cloudflare Access a `/api/docs` elé (opcionális)

Az `/api/docs` (Swagger UI) és az `/api/openapi.json` nyilvános. Ha csak a csapat érje el:
Cloudflare Zero Trust -> Access -> Applications -> Self-hosted, a domain `/api/docs*` és `/api/openapi.json` útvonalára
egy Allow szabály (e-mail lista vagy domain). Az API többi része **ne** kerüljön Access mögé, mert az API kulcsos
kliensek és a böngészős alkalmazás sem tud Access-bejelentkezésen átmenni.

## SQLite vagy Postgres?

**Döntés: marad az SQLite (WAL).** Indok: egyetlen `api` példány fut a házi szerveren, az írási terhelés kicsi
(kártyák, kommentek), az olvasás gyors, a mentés egyszerű. A Drizzle miatt a váltás olcsó maradna. Váltani akkor kell,
ha (1) több `api` példány kell (az SSE-busz és a hang-munkamenet-számláló folyamaton belüli, ide bróker is kellene),
(2) tartósan sok párhuzamos író van (`SQLITE_BUSY`), vagy (3) a mentés/visszaállítás RPO-ja napinál szigorúbb lenne.
