# TaskFlow – fejlesztési terv

## 1. Kiindulási állapot

A jelenlegi repó egy frontend-only PoC:
- egyetlen ~1400 soros `src/App.jsx`, minden állapot memóriában (`useState`), frissítés után elvész;
- működő funkciók: oszlopok (létrehozás, átnevezés + szín, törlés a feladatok átmozgatásával, drag & drop sorrend), kártyák (CRUD, prioritás, címkék, határidő-állapot, checklist, drag & drop oszlopon belül és között), keresés/szűrés, táblacím-szerkesztés, kedvenc;
- csak UI-makett (nincs mögötte logika): munkaterület-váltó, láthatóság, nézetváltó (lista/naptár/idővonal), tagok, meghívás.

A meglévő UI/UX megtartandó, de komponensekre bontva, és az adatok az API-ból jönnek.

## 2. Célarchitektúra

### 2.1 Technológiai döntések

| Terület | Választás | Indoklás |
|---|---|---|
| Nyelv | **TypeScript** (front + back) | Közös típusok és validációs sémák; nagyobb kódbázisnál ez tartja tisztán a rétegeket. A front fokozatosan migrálható. |
| Repo | **npm workspaces monorepo** | Egy repó, de élesen elváló csomagok; marad az npm. |
| Backend | **Node.js + Fastify** | Gyors, kicsi, első osztályú séma-validáció és OpenAPI-generálás. |
| Validáció / szerződés | **Zod** (`packages/shared`) | Ugyanaz a séma validál a backenden, a frontenden, és ebből generálódik az OpenAPI. |
| DB | **SQLite** (WAL mód) | Ingyenes, egyetlen fájl, nincs szerver, egy kis/közepes csapatnak bőven elég. |
| ORM / migráció | **Drizzle ORM + drizzle-kit** | Könnyű, típusos, SQL-közeli; ha később kell, minimális módosítással **PostgreSQL**-re váltható. |
| Auth (web) | Saját session: httpOnly, `SameSite=Lax` cookie, DB-ben tárolt session, **argon2** jelszóhash | Egyszerű, biztonságos, nincs külső függőség/költség. |
| Auth (gép/AI) | **API kulcs** (`tf_live_…`), DB-ben csak hash, scope-okkal | AI agent integrációhoz. |
| Frontend | React 19 + Vite, **TanStack Query** (szerver-állapot), **React Router** | Az API-cache és az optimista frissítések (drag & drop) kezelése. |
| Valós idő | **SSE** (Server-Sent Events) tábla szinten | Egyszerűbb, mint a WebSocket, és a kollaborációhoz elég. |
| Tesztelés | **Vitest** (unit/integráció), **Playwright** (E2E) | Gyors és Vite-kompatibilis. |
| Lint / formázás | oxlint (marad) + Prettier | |
| Futtatás | Docker Compose (api + web), SQLite volume | Egyparancsos indítás. |

> Az `AGENTS.md` jelenleg „sima JavaScript, TypeScript nélkül” szabályt tartalmaz. Ha a terv elfogadásra kerül, azt az M0-ban frissíteni kell. Az új függőségeket a terv elfogadásával tekintjük egyeztetettnek.

### 2.2 Repó-struktúra

```
taskflow/
├─ apps/
│  ├─ web/                    # React SPA
│  │  └─ src/
│  │     ├─ app/              # router, providerek, layout
│  │     ├─ features/         # feature-alapú modulok
│  │     │  ├─ auth/          # login, register, useSession
│  │     │  ├─ boards/        # BoardPage, BoardHeader, ...
│  │     │  ├─ columns/       # Column, RenameColumnModal, ...
│  │     │  ├─ cards/         # TaskCard, CardModal, Checklist, ...
│  │     │  ├─ workspaces/
│  │     │  └─ settings/      # profil, API kulcsok
│  │     ├─ shared/           # ui-kit (Modal, Button), hookok, utilok
│  │     └─ api/              # típusos API kliens (fetch wrapper)
│  └─ api/                    # Fastify backend
│     └─ src/
│        ├─ modules/          # modulonként rétegezve:
│        │  └─ cards/
│        │     ├─ cards.routes.ts      # HTTP réteg: route, séma, auth guard
│        │     ├─ cards.service.ts     # üzleti logika, jogosultság-ellenőrzés
│        │     ├─ cards.repository.ts  # DB hozzáférés (Drizzle)
│        │     └─ cards.test.ts
│        ├─ core/             # auth, authz (policy), hibakezelés, config, logger
│        ├─ db/               # schema.ts, migrációk, seed
│        └─ server.ts
├─ packages/
│  └─ shared/                 # Zod sémák, DTO típusok, enumok (role, priority)
├─ docs/
└─ docker-compose.yml
```

**Rétegszabályok:**
- `routes` → `service` → `repository` irányú függés; visszafelé soha.
- Route-ban nincs üzleti logika, service-ben nincs SQL vagy HTTP-objektum.
- Jogosultság-ellenőrzés mindig a service-ben, központi policy-függvénnyel (`can(actor, action, resource)`).
- A frontend kizárólag az `api/` kliensen keresztül kommunikál; komponens nem hív `fetch`-et közvetlenül.

### 2.3 Adatmodell (első változat)

```
users            (id, email UNIQUE, name, password_hash, avatar_url, created_at)
sessions         (id, user_id, expires_at, created_at, user_agent, ip)
workspaces       (id, name, slug, created_by, created_at)
workspace_members(workspace_id, user_id, role[owner|admin|member|viewer], joined_at)
invitations      (id, workspace_id, email, role, token_hash, expires_at, accepted_at)
boards           (id, workspace_id, title, visibility[private|workspace|public], created_by, archived_at)
board_members    (board_id, user_id, role[admin|editor|viewer])        -- private tábláknál
board_stars      (board_id, user_id)
columns          (id, board_id, title, accent, is_done, position)
cards            (id, column_id, title, description, priority[high|medium|low],
                  due_date, cover_image, position, created_by, archived_at,
                  created_at, updated_at, version)
labels           (id, board_id, name, color)
card_labels      (card_id, label_id)
checklists       (id, card_id, title, position)
checklist_items  (id, checklist_id, text, done, position)
card_assignees   (card_id, user_id)
comments         (id, card_id, author_id, body, created_at, edited_at)
activity_log     (id, board_id, actor_type[user|api_key], actor_id, action, entity, entity_id, payload_json, created_at)
api_keys         (id, owner_user_id, workspace_id, name, prefix, key_hash, scopes_json,
                  last_used_at, expires_at, revoked_at, created_at)
```

- **ID-k:** ULID vagy UUIDv7 (rendezhető, nem kitalálható).
- **Sorrend:** `position` mező fractional indexing (string) alapon, így egy áthelyezés egyetlen sor frissítése.
- **Optimista zárolás:** a `version` mezővel 409-et kap az, aki elavult kártyát próbál menteni.
- A prioritás tárolása nyelvfüggetlen enum, a magyar címkék a UI-ban vannak.

### 2.4 Authentikáció és authorizáció

- **Szereplők:** bejelentkezett felhasználó (session cookie) vagy API kulcs. Mindkettő ugyanarra az `Actor` objektumra képződik le, így a service réteg nem tudja (és nem is kell tudnia), honnan jön a kérés.
- **Szerepkörök:**
  - Munkaterület: `owner` > `admin` > `member` > `viewer`.
  - Tábla: privát táblán `board_members` szerepkör; a `public` tábla anonim módon olvasható.
- **Policy-mátrix** (`core/authz/policies.ts`) egy helyen, unit tesztekkel lefedve.
- **API kulcs:**
  - A felhasználó hozza létre, munkaterülethez kötve.
  - A kulcs csak egyszer jelenik meg, a DB-ben csak SHA-256 hash van (prefix-szel kereshető).
  - Scope-ok: `boards:read`, `boards:write`, `cards:read`, `cards:write`, `comments:write`.
  - A kulcs jogai sosem haladhatják meg a tulajdonos aktuális jogait (metszet).
  - Lejárat és visszavonás támogatott; `Authorization: Bearer tf_live_…` fejlécben küldendő.
- **Védelem:**
  - rate limit (IP / kulcs szerint);
  - CSRF-védelem a cookie-s kéréseknél (`SameSite` + Origin-ellenőrzés);
  - brute-force védelem loginnál;
  - auditlog minden írásról (`activity_log`).

### 2.5 API-tervezés (AI agent szempontból)

- REST, verziózott: `/api/v1/...`; erőforrás-orientált, konzisztens hibaformátum (`{ error: { code, message, details } }`).
- **OpenAPI 3.1** generálása a Zod sémákból, valamint Swagger UI a `/api/docs` útvonalon. Ebből egy AI agent eszközöket tud generálni.
- Lapozás (cursor-alapú), szűrés (`?q=`, `?label=`, `?due_before=`), `Idempotency-Key` fejléc a POST-oknál (az agent retry-biztos lehet).
- Magas szintű, agent-barát végpontok is:
  - `POST /cards/{id}/move` (`{ columnId, beforeCardId? }`);
  - `GET /boards/{id}/snapshot` (teljes tábla egy hívásban).
- **Webhookok** (később): `card.created`, `card.moved`, … aláírt (HMAC) payloaddal.
- **MCP szerver** (opcionális, M7): vékony wrapper az API kulcsos REST fölött, így egy AI agent (pl. opencode/Claude) közvetlenül eszközként használhatja.

Fő végpontok:

```
POST   /auth/register | /auth/login | /auth/logout      GET /auth/me
GET    /workspaces                    POST /workspaces
GET    /workspaces/{id}/members       POST /workspaces/{id}/invitations
GET    /workspaces/{id}/boards        POST /workspaces/{id}/boards
GET    /boards/{id}  PATCH  DELETE    GET  /boards/{id}/snapshot
POST   /boards/{id}/columns           PATCH/DELETE /columns/{id}   POST /columns/{id}/move
POST   /columns/{id}/cards            GET/PATCH/DELETE /cards/{id} POST /cards/{id}/move
POST   /cards/{id}/checklists, /checklists/{id}/items, /cards/{id}/comments
GET    /boards/{id}/events   (SSE)
GET/POST/DELETE /me/api-keys
```

## 3. Mérföldkövek és sprintek

Sprinthossz: 2 hét (egy fejlesztővel + AI asszisztenssel reális becslés). Minden mérföldkő végén működő, demózható állapot.

### M0 – Alapozás és refaktor (Sprint 1)
**Cél:** tiszta alap; a meglévő funkciók változatlanul működnek, de rendezett kódban.
- monorepo (`apps/web`, `apps/api`, `packages/shared`), npm workspaces;
- TypeScript-konfig; a frontend átkerül `apps/web`-be;
- `App.jsx` szétbontása feature-komponensekre és hookokra:
  - `useBoardState` reducerrel (`useReducer`) a sok `setColumns` helyett;
  - külön komponensek: `Board`, `Column`, `TaskCard`, `CardModal`, `ChecklistEditor`, `RenameColumnModal`, `ConfirmModal`, `Topbar`, `BoardHeader`;
  - az `App.css` szétosztása komponens-szintű CSS (Modules) fájlokba;
- tiszta függvények (`getDueDateState`, `getChecklistProgress`, `parseTags`) átköltöztetése `shared`-be, unit tesztekkel;
- Prettier, Vitest, CI (GitHub Actions: lint + typecheck + test + build);
- `AGENTS.md` frissítése az új struktúrához.

**Kész, ha:** a UI pixelre ugyanaz, az `App.jsx` < 100 sor, és a CI zöld.

### M1 – Backend váz és perzisztencia (Sprint 2–3)
**Cél:** a tábla adatai SQLite-ban élnek; egyelőre még auth nélkül, egy seed felhasználóval.
- Fastify szerver:
  - config (env + Zod validáció);
  - strukturált logolás (pino);
  - központi hibakezelő;
  - health check;
- Drizzle-séma (boards, columns, cards, labels, checklists, items), migrációk, seed (a jelenlegi `initialColumns`);
- modulok: boards, columns, cards, checklists (routes/service/repository) + integrációs tesztek in-memory SQLite-tal;
- fractional indexing a mozgatáshoz; `POST /cards/{id}/move`, `POST /columns/{id}/move`;
- OpenAPI + Swagger UI;
- frontend: TanStack Query, API kliens, optimista drag & drop rollbackkel;
- Vite dev proxy `/api` → backend.

**Kész, ha:** frissítés után minden adat megmarad, és a teljes CRUD + mozgatás API-n keresztül is működik.

### M2 – Felhasználókezelés és authentikáció (Sprint 4)
- regisztráció, login, logout, `GET /auth/me`; session tábla, argon2;
- jelszó-visszaállítás e-mail tokennel (fejlesztői módban konzol-mailer, később SMTP);
- rate limit, login-brute-force védelem, CSRF/Origin-ellenőrzés;
- frontend: login/regisztráció oldalak, védett route-ok, felhasználói menü (az avatar működik);
- profil szerkesztése (név, avatar).

**Kész, ha:** csak bejelentkezve érhető el a tábla, és a session túléli az újraindítást.

### M3 – Munkaterületek, tagság, authorizáció (Sprint 5–6)
- workspace CRUD; a munkaterület-váltó valódi adatból dolgozik;
- több tábla munkaterületenként: táblalista oldal, kedvencek (`board_stars`);
- meghívás e-mailben (token, lejárat, szerepkör); a meglévő „Meghívás” modal bekötése;
- tagkezelés: szerepkör módosítása, eltávolítás;
- tábla-láthatóság (`private` / `workspace` / `public`) valódi jogosultsággal;
- policy-modul + mátrix-tesztek (minden szerep × minden művelet);
- a UI elrejti/letiltja a nem engedélyezett műveleteket (de a backend a forrása az igazságnak).

**Kész, ha:** két felhasználó közösen dolgozhat egy táblán, és egy `viewer` semmit nem tud módosítani (API-n át sem).

### M4 – Nyilvános API és API kulcsok (Sprint 7)
**Cél:** AI agent biztonságosan elérheti a rendszert.
- API kulcs kezelése (Beállítások → API kulcsok): létrehozás, scope-ok, lejárat, visszavonás, „utoljára használva”;
- Bearer-auth middleware, a scope ∩ tulajdonosi jog alapú ellenőrzés;
- `Idempotency-Key` támogatás, cursor-lapozás, szűrés;
- `GET /boards/{id}/snapshot` agent-barát összefoglaló végpont;
- `activity_log` actor-típussal (látszik, mit csinált az AI);
- API-dokumentáció: OpenAPI export + rövid „Getting started for agents” leírás, curl példák;
- kulcsonkénti rate limit.

**Kész, ha:** egy kulccsal curl-ből létrehozható és áthelyezhető egy kártya, egy visszavont kulcs 401-et kap, és egy hatókörön kívüli művelet 403-at.

### M5 – Kollaboráció és valós idő (Sprint 8–9)
- SSE csatorna táblánként; a változások élőben jelennek meg más felhasználóknál (és az agent módosításai is);
- optimista zárolás (`version`), konfliktus-üzenet;
- hozzárendelt felhasználók a kártyákon (a tag-avatarok valódiak);
- kommentek, @említés;
- tevékenység-napló panel a táblán / a kártyán;
- értesítések (a harang ikon): hozzárendelés, említés, közelgő határidő.

### M6 – Funkcióbővítés (Sprint 10–11)
- a nézetváltó bekötése: **Lista**, **Naptár** (határidő alapján), **Idővonal**;
- haladó szűrés (címke, tag, határidő, prioritás), mentett szűrők;
- tábla-szintű címkekezelés (átnevezés, szín), több checklist kártyánként;
- borítókép / csatolmányok (lokális fájltár, később S3-kompatibilis);
- archiválás és visszaállítás (kártya, oszlop, tábla);
- billentyűparancsok, akadálymentesítés (drag & drop billentyűzettel is).

### M7 – AI integráció és üzemeltetés (Sprint 12)
- **MCP szerver** csomag (`apps/mcp`): eszközök: `list_boards`, `get_board`, `create_card`, `move_card`, `update_card`, `add_comment`;
- webhookok HMAC-aláírással (opcionális);
- Docker Compose produkciós profil, SQLite-mentés (pl. Litestream vagy cron + `sqlite3 .backup`);
- E2E tesztcsomag (Playwright) a kritikus folyamatokra;
- teljesítmény: indexek, N+1 ellenőrzés;
- döntési pont: maradhat-e SQLite, vagy Postgres-re kell váltani (Drizzle miatt olcsó váltás).

## 4. Keresztmetszeti szabályok (minden sprintben)

- Minden új végpont: Zod séma a `shared`-ben, integrációs teszt, jogosultsági teszt és OpenAPI-leírás.
- „Definition of Done”: lint + typecheck + teszt + build zöld, és nincs logika a route/komponens rossz rétegében.
- Migráció csak előre (a drizzle-kit generál), seed idempotens.
- Titkok csak `.env`-ben (`.env.example` commitolva).
- Kis, fókuszált commitok; a `main` mindig buildelhető.

## 5. Kockázatok és nyitott kérdések

| Téma | Megjegyzés |
|---|---|
| SQLite skálázhatóság | Egy szerverpéldány mellett jó; több példány vagy nagy írási terhelés esetén Postgres. Drizzle miatt alacsony váltási költség. |
| TS-migráció | Az M0 nagyobb lépés; alternatíva: a backend TS, a frontend JS + JSDoc marad. |
| E-mail küldés | Melyik szolgáltató? (fejlesztéshez konzol-mailer elég) |
| Hosztolás | Saját VPS / Fly.io / Railway? Ez befolyásolja a fájltárat és a mentést. |
| Nyelv | Csak magyar UI, vagy i18n (hu/en) már az M0-ban? |
