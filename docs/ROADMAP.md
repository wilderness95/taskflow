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
| E-mail | **Nodemailer** + **Gmail SMTP** (app password) | Ingyenes, kis felhasználói bázishoz elég (napi ~500 levél limit). Interfész mögött, később cserélhető. |
| i18n | **i18next + react-i18next** (web), saját kis `t()` a backendben (e-mailek) | Egyelőre csak magyar, de új nyelv = új fordítási fájl. Lásd 2.6. |
| Futtatás | Docker Compose (web + api + cloudflared) a házi szerveren, SQLite volume | Egyparancsos indítás, nyitott port nélkül. Lásd 2.7. |

> **Elfogadott döntések:** TypeScript a nyelv (az `AGENTS.md` frissítve); a fenti stack függőségei jóváhagyottak; e-mail: Gmail app passworddel; üzemeltetés: Docker Compose a házi szerveren, Cloudflare Tunnelen, saját domainnel; egyelőre csak magyar UI, de i18n-re felkészítve.

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
│  │     ├─ i18n/             # i18next init + locales/hu/*.json
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
│        ├─ mail/             # Mailer interfész, SMTP + konzol implementáció, sablonok
│        ├─ i18n/             # backend szövegek (e-mailek): locales/hu.ts
│        ├─ db/               # schema.ts, migrációk, seed
│        └─ server.ts
├─ packages/
│  └─ shared/                 # Zod sémák, DTO típusok, enumok, hibakódok
├─ deploy/                    # cloudflared config, backup script
├─ docs/
├─ .env.example
└─ docker-compose.yml
```

**Rétegszabályok:**
- `routes` → `service` → `repository` irányú függés; visszafelé soha.
- Route-ban nincs üzleti logika, service-ben nincs SQL vagy HTTP-objektum.
- Jogosultság-ellenőrzés mindig a service-ben, központi policy-függvénnyel (`can(actor, action, resource)`).
- A frontend kizárólag az `api/` kliensen keresztül kommunikál; komponens nem hív `fetch`-et közvetlenül.

### 2.3 Adatmodell (első változat)

```
users            (id, email UNIQUE, name, password_hash, avatar_url, locale DEFAULT 'hu', created_at)
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
- A DB-ben minden enum nyelvfüggetlen (`high`, `medium`, `low`); a megjelenített szöveg kizárólag a fordítási fájlokból jön.
- A felhasználó által beírt tartalom (táblacím, kártyaszöveg, címke) nem fordítandó, és úgy is marad.

### 2.4 Authentikáció és authorizáció

- **Szereplők:** bejelentkezett felhasználó (session cookie) vagy API kulcs. Mindkettő ugyanarra az `Actor` objektumra képződik le, így a service réteg nem tudja (és nem is kell tudnia), honnan jön a kérés.
- **Szerepkörök:**
  - Munkaterület: `owner` > `admin` > `member` > `viewer`.
  - Platform-admin (`users.is_admin`) külön, rendszerszintű jogosultság; nem azonos a munkaterületi `admin` szereppel. A platform-admin felülete és API-ja kizárólag ezzel a jogosultsággal érhető el.
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

### 2.6 Többnyelvűségre felkészítés (i18n)

Egyelőre csak magyar UI lesz, de **egy új nyelv bevezetése ideális esetben csak új fordítási fájlok hozzáadását és egy sor regisztrációt jelentsen**, a komponensekhez ne kelljen nyúlni.

Szabályok:
- **Nincs beégetett UI-szöveg.** Minden felirat, placeholder, `aria-label`, toast és confirm üzenet a `t('kulcs')` függvényen keresztül jön (`apps/web/src/i18n/locales/hu/<namespace>.json`).
- **Névterek feature-önként** (`common`, `board`, `card`, `auth`, `settings`, `errors`), így a fordítási fájlok kicsik és áttekinthetők maradnak.
- **Típusbiztos kulcsok:** a magyar fájl a forrás. A TypeScript-típusok ebből jönnek, így egy elírt vagy hiányzó kulcs fordítási hiba; egy új nyelvnél a hiányzó kulcs CI-hiba (kulcs-egyezés teszt).
- **Formázás csak központi helperrel:** a dátum, a szám és a relatív idő a `shared/format.ts` függvényein megy át (`Intl`, az aktuális locale-lal); `toLocaleDateString` vagy beégetett `'hu-HU'` sehol máshol.
- **Többes szám és interpoláció** az i18next beépített megoldásával (`{{count}} feladat`), nem string-összefűzéssel.
- **A backend nem küld megjelenítendő szöveget.** A hibák `code` + `params` formátumúak (pl. `CARD_NOT_FOUND`); a fordítást a frontend végzi (`errors` namespace). A Zod-validációs hibák is kódként mennek át.
- **E-mail sablonok** a backend `i18n/locales/<lang>.ts` fájljaiból, a címzett `users.locale` mezője alapján.
- **Nyelvválasztás** egyetlen helyen (`i18n/index.ts`): most fixen `hu`; később a felhasználói profilból vagy a böngészőből.

**Új nyelv hozzáadása (cél):** `locales/en/*.json` + backend `locales/en.ts` + egy sor a támogatott nyelvek listájában + egy nyelvválasztó a profilban (egyszeri feladat).

### 2.7 Üzemeltetés: házi szerver + Docker Compose + Cloudflare Tunnel

```
Internet ──► Cloudflare (saját domain, TLS) ──► cloudflared konténer (kimenő tunnel)
                                                   │
                         ┌─────────────────────────┴───────────┐
                    /api/* ─► api (Fastify, :3000)        /* ─► web (nginx, statikus SPA, :80)
                                  │
                         volume: ./data/taskflow.db (+ uploads, backup)
```

- **Három szolgáltatás** a `docker-compose.yml`-ben: `web`, `api`, `cloudflared`. Nincs host-portkiengedés és routeren nyitott port: a tunnel kifelé kapcsolódik.
- **Egy domain, path-alapú routing** a tunnel ingress-ben (`/api/*` → api, minden más → web). Így nincs CORS, és a cookie first-party marad.
- **Konfiguráció `.env`-ből** (nincs commitolva), a `.env.example` dokumentálja:
  - `APP_URL`, `SESSION_SECRET`, `DATABASE_PATH`;
  - `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER`, `SMTP_PASS` (Gmail app password), `MAIL_FROM`;
  - `CLOUDFLARE_TUNNEL_TOKEN`.
- **Cloudflare mögötti teendők a backendben:**
  - `trustProxy` bekapcsolva, a kliens IP-je a `CF-Connecting-IP` fejlécből (rate limit, audit, session);
  - cookie: `Secure`, `HttpOnly`, `SameSite=Lax`;
  - Origin-ellenőrzés az `APP_URL` alapján;
  - SSE: ~25 mp-es heartbeat és `X-Accel-Buffering: no`, hogy a proxy ne zárja le és ne pufferelje a kapcsolatot.
- **Opcionális:** Cloudflare Access (Zero Trust) a `/api/docs` elé, illetve igény esetén a teljes app elé.
- **Mentés:** napi `sqlite3 .backup` cron/sidecar konténerrel, rotációval; opcionálisan Litestream külső tárolóra.
- **Frissítés:** `git pull && docker compose up -d --build`; a migrációk az api indulásakor automatikusan lefutnak.
- **E-mail (Gmail):**
  - Nodemailer SMTP-n keresztül, `Mailer` interfész mögött: fejlesztéskor `ConsoleMailer`, élesben `SmtpMailer`;
  - Gmail limit: kb. 500 levél/nap. Kis felhasználói bázisnál elég; ha kinőjük, csak az implementáció cserélődik.

## 3. Mérföldkövek és sprintek

Sprinthossz: 2 hét (egy fejlesztővel + AI asszisztenssel reális becslés). Minden mérföldkő végén működő, demózható állapot.

### M0 – Alapozás és refaktor (Sprint 1)
**Cél:** tiszta alap; a meglévő funkciók változatlanul működnek, de rendezett kódban.
- monorepo (`apps/web`, `apps/api`, `packages/shared`), npm workspaces;
- TypeScript-konfig; a frontend átkerül `apps/web`-be;
- `App.jsx` szétbontása feature-komponensekre és hookokra:
  - `useBoardState` reducerrel (`useReducer`) a sok `setColumns` helyett;
  - külön komponensek: `Board`, `Column`, `TaskCard`, `CardModal`, `ChecklistEditor`, `RenameColumnModal`, `ConfirmModal`, `Topbar`, `BoardHeader`;
  - az `App.css` szétosztása a komponensek melletti, sima CSS fájlokba (az osztálynevek megmaradtak; a CSS Modules-ra váltás későbbi, opcionális lépés);
- tiszta függvények (`getDueDateState`, `getChecklistProgress`, `parseTags`) átköltöztetése `shared`-be, unit tesztekkel;
- **i18n alapok:**
  - i18next beállítása;
  - az összes jelenlegi magyar szöveg kiszervezése `locales/hu/*.json`-ba;
  - típusos kulcsok;
  - `format.ts` (dátum, szám);
  - prioritás enum nyelvfüggetlenítése (`Magas` → `high`);
- Prettier, Vitest, CI (GitHub Actions: lint + typecheck + test + build);
- `AGENTS.md` frissítése az új struktúrához.

**Kész, ha:** a UI pixelre ugyanaz, az `App.tsx` < 100 sor, a komponensekben nincs beégetett UI-szöveg, és a CI zöld.

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
- Vite dev proxy `/api` → backend;
- **korai Docker Compose** (`web` + `api` + `cloudflared`), `.env.example`, Dockerfile-ok (multi-stage). Így az M1 végétől már a házi szerveren is fut, a saját domainen.

**Kész, ha:** frissítés után minden adat megmarad, a teljes CRUD + mozgatás API-n keresztül is működik, és a `docker compose up -d` után a domainen elérhető.

### M2 – Felhasználókezelés és authentikáció (Sprint 4)
- regisztráció, login, logout, `GET /auth/me`; session tábla, argon2;
- **Mailer modul:** `Mailer` interfész, `ConsoleMailer` (dev), `SmtpMailer` (Gmail, app password), sablonok i18n-ből;
- jelszó-visszaállítás e-mail tokennel; e-mail-cím megerősítése;
- rate limit (`CF-Connecting-IP` alapján), login-brute-force védelem, CSRF/Origin-ellenőrzés;
- **Regisztrációs mód:** élesben az első regisztrált felhasználó lesz az admin, utána a regisztráció csak meghívással (zárt rendszer, kis felhasználói bázis); env-ben kapcsolható.
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

**Megvalósítás (kész):**
- SSE: `GET /boards/{id}/events` (`text/event-stream`, 25 mp-es heartbeat); az eseményt az `ActivityService.record` adja ki egy folyamaton belüli bus-ra (`events/eventBus.ts`), így minden naplózott írás (ember és agent) élőben megjelenik. Az esemény vékony (`BoardEvent`), a kliens újraolvassa a változást. Felhasználónként legfeljebb 20 nyitott csatorna. Több api példánynál külső bróker kellene.
- Optimista zárolás: a `PATCH /cards/{id}` és a `POST /cards/{id}/move` opcionális `version` mezője; eltérésnél `409 version_conflict` (`details.card`: az aktuális kártya). `version` nélkül utolsó írás nyer (agent-barát).
- Felelősök: `card_assignees`, `assigneeIds` a kártyán; `GET /boards/{id}/participants` a hozzárendelhető/megemlíthető felhasználókat adja.
- Kommentek: `comments`, `comment_mentions`; `GET|POST /cards/{id}/comments`, `PATCH|DELETE /comments/{id}`; az @említés a szövegben `@Név`, a `mentionIds` explicit (az API kulccsal írt komment `viaApiKey`).
- Tevékenység: tábla- és kártyaszintű napló (`GET /cards/{id}/activity`), panel a táblán és a kártya szerkesztőjében.
- Értesítések: `notifications` tábla, `GET /notifications`, `POST /notifications/{id}/read|read-all` (csak session); a határidő-emlékeztetőt időzítő adja ki (`DUE_REMINDER_INTERVAL_MINUTES`), kártyánként és határidőnként egyszer.

### M6 – Funkcióbővítés (Sprint 10–11)
- a nézetváltó bekötése: **Lista**, **Naptár** (határidő alapján), **Idővonal**;
- haladó szűrés (címke, tag, határidő, prioritás), mentett szűrők;
- tábla-szintű címkekezelés (átnevezés, szín), több checklist kártyánként;
- borítókép / csatolmányok (lokális fájltár, később S3-kompatibilis);
- archiválás és visszaállítás (kártya, oszlop, tábla);
- billentyűparancsok, akadálymentesítés (drag & drop billentyűzettel is).

**Megvalósítás (kész):**
- Archiválás: `POST /cards|columns/{id}/archive|restore`, `POST /boards/{id}/restore`, `GET /boards/{id}/archive` (az archivált kártyák és oszlopok), `GET /workspaces/{id}/boards?archived=true` (a visszaállítható táblák). Az archivált oszlop a kártyáival együtt eltűnik; kártya csak aktív oszlopba állítható vissza (`409 column_archived`). A tábla archiválása a meglévő `DELETE /boards/{id}`.
- Címkék: `PATCH|DELETE /labels/{id}` (a név táblánként egyedi, `409 label_name_taken`; törléskor a kártyákról is lekerül). Címkekezelő ablak a táblán.
- Több checklist: a backend eddig is támogatta, a szerkesztő és a mentés most kezeli (hozzáadás, törlés, átnevezés).
- Csatolmányok: `attachments` tábla, `FileStore` felület (lokális fájltár: `UPLOAD_DIR`, `MAX_UPLOAD_MB`; S3-kompatibilis megvalósítás ugyanezen a felületen később). Feltöltés nyers törzzsel (`POST /cards/{id}/attachments?name=...`, a `Content-Type` a fájl típusa; nincs multipart függőség), letöltés `GET /attachments/{id}/file` (csak PNG/JPEG/GIF/WebP jelenik meg a böngészőben, minden más letöltés; `nosniff` + `sandbox` CSP). Borító: `coverAttachmentId` a kártyán.
- Szűrés: a kártyalistán új `assigneeId` szűrő; a UI haladó szűrője (prioritás, címke, felelős, határidő-állapot) kliensoldali, tiszta függvényekkel (`packages/shared/src/boardFilter.ts`). Mentett szűrők felhasználónként és táblánként (`GET|POST /boards/{id}/filters`, `DELETE /filters/{id}`, csak session).
- Nézetek: Lista (táblázat), Naptár (hónap, hétfői kezdéssel) és Idővonal (sáv a létrehozástól a határidőig; legfeljebb 120 napos tengely); a Kanban szűrői mindegyikre érvényesek.
- Billentyűzet és akadálymentesség: gyorsbillentyűk (`N`, `/`, `F`, `?`, `1`-`4`), kártya és oszlop áthelyezése Alt + nyíllal (aria-live felolvasással), `Enter` a kártya megnyitása; a párbeszédablak `role="dialog"`, Escape zárja, fókuszcsapda és fókuszvisszaadás.

### M7 – AI integráció (élő hangvezérlés) és üzemeltetés (Sprint 12)
- **MCP szerver** csomag (`apps/mcp`): beszédbarát, összevont eszközök:
  - `list_boards`;
  - `get_board_overview`: egy hívásban a snapshot és a résztvevők (a korábbi `get_board` helyett);
  - `create_card`: egy körben kezeli a felelősöket, a címkéket és a checklistet is;
  - `search_cards`: szöveges keresés (hangalapú kereséshez);
  - `move_card`, `update_card`, `add_comment`;
  - az API-t hívó HTTP wrapper minden POST/PATCH/DELETE kéréshez automatikus `Idempotency-Key`-t (UUID) generál, és hálózati hiba esetén ugyanazzal a kulccsal újrapróbál;
  - alapértelmezett átvitel: **stdio**. Így ugyanaz a csomag szolgálja ki a szerveren a beépített hangasszisztenst, és helyben futtatva bármilyen külső AI eszközt (Claude Desktop, Gemini CLI, OpenCode);
- **Élő hangasszisztens backend (`apps/api`, `modules/voice/`):**
  - `WS /api/v1/voice/live?boardId=...`: csak bejelentkezett sessionnel érhető el (API kulccsal nem); a Gemini API kulcs nem kerülhet a böngészőbe;
  - Gemini Live híd: a végpont `ai.live.connect` munkamenetet nyit (`@google/genai`), az `@taskflow/mcp` szervert belső hálózaton (stdio vagy lokális HTTP) rákötve oda-vissza streameli a nyers PCM audiót, és továbbítja a tool hívásokat;
  - kontextus injektálás: az aktuális dátumot és az éppen nézett `boardId`-t a szerver automatikusan beteszi a `systemInstruction`-be;
  - az MCP hívások a belépett felhasználó jogaival futnak (a service-réteg policyja érvényes, nincs külön jogosultsági út);
- **Élő hangasszisztens frontend (`apps/web`):**
  - mikrofon gomb lebegő vagy a Topbar-ba épített vezérlőként, állapotjelzővel (hallgat / gondolkodik / beszél) és megszakítás/barge-in támogatással;
  - Web Audio réteg: `AudioWorklet` a mikrofon 16 kHz-es PCM rögzítéséhez, pufferelt lejátszó a 24 kHz-es válaszokhoz;
  - a tábla élő frissítését nem kell külön megírni: az M5-ös SSE és a TanStack Query automatikusan frissít, amint az MCP létrehoz vagy módosít egy kártyát;
  - minden felirat és állapotszöveg i18n kulccsal;
- webhookok HMAC-aláírással (opcionális);
- Docker Compose véglegesítése:
  - `GEMINI_API_KEY` felvétele a `.env.example`-be (érték nélkül) és az `api` konténerbe;
  - healthcheckek, `restart: unless-stopped`, log-rotáció;
  - napi SQLite-mentés sidecarral, rotációval (opcionálisan Litestream);
  - visszaállítási próba dokumentálva;
- üzemeltetési teszt: a WebSocket átmegy-e a Cloudflare Tunnelen és az nginx proxyn (upgrade fejlécek, hosszú idejű kapcsolat);
- opcionálisan Cloudflare Access a `/api/docs` elé;
- E2E tesztcsomag (Playwright) a kritikus folyamatokra;
- teljesítmény: indexek, N+1 ellenőrzés;
- döntési pont: maradhat-e SQLite, vagy Postgres-re kell váltani (Drizzle miatt olcsó váltás).

**Megvalósítás (kész):**
- MCP (`apps/mcp`, `@taskflow/mcp`): `createTaskflowMcpServer(apiClient)` a hét összevont eszközzel (`list_boards`, `get_board_overview`, `create_card`, `search_cards`, `move_card`, `update_card`, `add_comment`); az oszlop, címke és személy névvel is megadható (ékezet- és kisbetű-érzéketlen feloldás, hibánál nem jön létre fél kártya). Az API-kliens minden író kérésre UUID `Idempotency-Key`-t tesz, hálózati hibánál ugyanazzal újrapróbál. Stdio belépő: `apps/mcp/src/stdio.ts` (`TASKFLOW_URL`, `TASKFLOW_API_KEY`).
- Hangasszisztens backend: `WS /api/v1/voice/live?boardId=...` (`modules/voice/`), csak session-nel (`session_required` kulccsal), `Origin` ellenőrzéssel (cross-site WebSocket ellen). A híd a `@taskflow/mcp` szervert **memórián belüli átvitellel** köti a Gemini Live munkamenetre, az API-t a saját folyamatban (`inject`) a felhasználó session cookie-jával hívja, így nincs külön jogosultsági út, és az SSE is frissül. A `systemInstruction` az aktuális dátumot és a nézett táblát tartalmazza; a `boardId`-t nem megadó eszközhívásokba a szerver beteszi. Korlátok: `VOICE_MAX_SESSIONS_PER_USER`, `VOICE_MAX_MINUTES`; `GEMINI_API_KEY` nélkül 503 `voice_unavailable`. Protokoll: `packages/shared/src/schemas/voice.ts`; `GET /health` -> `voice: bool` mondja meg a frontendnek, hogy van-e hangasszisztens.
- Hangasszisztens frontend (`features/voice/`): mikrofon gomb a Topbarban (állapot: hallgat / gondolkodik / beszél), `AudioWorklet` 16 kHz-es PCM-rögzítés, pufferelt 24 kHz-es lejátszó, szerver-oldali (modell) és kézi megszakítás; minden szöveg i18n kulccsal (`voice` névtér).
- Webhookok: `GET|POST /boards/{id}/webhooks`, `PATCH|DELETE /webhooks/{id}` (board admin, csak session). HMAC-SHA256 aláírás (`X-TaskFlow-Signature: t=<unix>,v1=<hex>`), 3 próbálkozás azonos `deliveryId`-val, 10 egymás utáni hiba után automatikus kikapcsolás, SSRF-védelem (privát/loopback cél tiltva, névfeloldás után is). A titok AES-256-GCM-mel tárolt (`SESSION_SECRET`-ből származtatott kulcs), mert az aláíráshoz a nyers érték kell; csak létrehozáskor látszik. Felület (UI) nincs hozzá, az API-n kezelhető.
- Üzemeltetés: lásd `docs/OPERATIONS.md` (healthcheckek, log-rotáció, nginx WebSocket upgrade, napi mentés sidecar és visszaállítás, Cloudflare Access, SQLite/Postgres döntés: **marad az SQLite**).
- Teljesítmény: indexek az idegen kulcsokra (migráció `0011`) és egy lekérdezésszám-teszt (`queryCount.test.ts`), amely a beolvasó végpontokon az N+1-et zárja ki.
- E2E: `apps/e2e` (Playwright, Chromium): regisztráció/belépés, tábla és kártya, valamint az API kulcsos agent élő megjelenése az SSE-n át. Futtatás: `npm run e2e -w @taskflow/e2e` (egyszer: `npx playwright install chromium`); a CI külön job-ban futtatja.
- Nem része az M7-nek: a webhook-kezelő UI, a Cloudflare Tunnelen végzett éles WebSocket-próba (a checklist a `docs/OPERATIONS.md`-ben; a deploykor kell elvégezni).

> **Új függőségek (az M7-ben bevezetve):** `@google/genai`, `@modelcontextprotocol/sdk`, `@fastify/websocket`, és fejlesztői függőségként a `@playwright/test`.

### M8 – Listák: teendő- és bevásárlólista (Sprint 13)

Cél: egyszerű, kanban nélküli lista (teendő, bevásárlás), amely munkaterületen belül megosztható. Az Android-kliens (M9) előtt készül.

**Döntések:** önálló `lists` modul (nem a tábla/kártya modell fölött); a megosztás a meglévő munkaterületi tagságon és szerepkörökön alapul (policy: `packages/shared/src/authz.ts`, új `list:*` műveletek); nincs új külső függőség.

**Első verzió:**
- Lista (`lists`: név, munkaterület, `archivedAt`), szakasz (`list_sections`: pl. zöldség, tejtermék; `position`) és tétel (`list_items`: szöveg, `done`, `position`, opcionális szakasz, `version`).
- Tétel felvétele, szerkesztése, kipipálása, törlése; sorrend húzással és billentyűzettel (fractional indexing); szakaszok kezelése és tételek szakaszok közti mozgatása.
- Ismétlődő tételek: a tétel `recurring` jelölést kap; a „Visszaállítás" művelet a kipipált ismétlődő tételeket újra nyitja (a nem ismétlődő kipipáltak törölhetők egy lépésben: „Kipipáltak törlése").
- Archiválás (nem végleges törlés), visszaállítás külön végponttal; az archivált elem a listákból kimarad.
- API: `/api/v1/workspaces/{id}/lists`, `/lists/{id}`, `/lists/{id}/sections`, `/lists/{id}/items`, `/items/{id}`; Zod sémák a `shared`-ben, OpenAPI, cursor-lapozás, `Idempotency-Key`; GET = `boards:read`, írás = `boards:write` scope (az `auth/scopes.ts`-ben ellenőrizve).
- Naplózás: az írások az `ActivityService.record`-on át az `activity_log`-ba, valós idejű frissítés külön SSE csatornán (munkaterületi/listaszintű), hogy a közös lista élőben frissüljön.
- Frontend: `features/lists/` (listaválasztó, listanézet, gyors tételfelvétel Enterrel, szakaszok, mobilbarát nagy érintési felületek), `lists` i18n névtér, hozzáférhetőség (billentyűzet, aria-live); TanStack Query hookok az `api/` kliensen át.
- Migráció `drizzle-kit generate`-tel; tesztek: tiszta függvények (sorrend, ismétlődő visszaállítás) unit, integrációs és jogosultsági teszt (viewer nem írhat, nem tag nem lát), E2E egy forgatókönyvvel.
- Becslés: kb. 3–5 nap.

**Nincs az első verzióban:** határidő/emlékeztető, mennyiség/egység mezők, MCP-eszköz a listákhoz (később, a meglévő végpontokra épülve).

**Megvalósítás (kész):**
- Adatmodell: `lists` (munkaterület, `archivedAt`), `list_sections`, `list_items` (`done`, `recurring`, `position`, `version`); migráció `0012`. Szakasz törlésekor a tételek szakasz nélkül megmaradnak (a sorrendjük megőrzésével).
- Jogosultság: új `list:read` / `list:write` munkaterületi művelet a központi policyban (`owner`/`admin`/`member` ír, `viewer` olvas); az `AccessService.requireList|requireListSection|requireListItem` oldja fel az erőforrást, nem tagnak 404.
- API: `GET|POST /workspaces/{id}/lists` (`?archived=true`), `GET|PATCH /lists/{id}`, `POST /lists/{id}/archive|restore|clear-done|reset-recurring`, `POST /lists/{id}/sections|items`, `PATCH|DELETE /list-sections|list-items/{id}`, `POST /list-sections|list-items/{id}/move`, `GET /lists/{id}/events` (SSE, `list` esemény). Korlátok: 100 lista / munkaterület, 50 szakasz és 500 tétel / lista. A kulcs hatóköre az alapszabály (olvasás `boards:read`, írás `boards:write`).
- Valós idő: az `ActivityService.record` az opcionális `listId`-vel a lista saját SSE csatornájára is publikál (`EventBus.publishList`), a webhookoktól és a tábla-csatornától függetlenül; az írások a `activity_log`-ba kerülnek (`workspaceId`-val, `boardId` nélkül).
- Frontend: `features/lists/` (`/w/:id/lists` áttekintés, `/l/:id` lista); tételek felvétele Enterrel, optimista pipálás, szerkesztő (szöveg, szakasz, ismétlődés; érintésre is jó), húzásos és Alt + nyíl (aria-live) sorrendezés, szakaszkezelés, „Ismétlődők visszaállítása” / „Kipipáltak törlése” / archiválás, archivált listák visszaállítása; `lists` i18n névtér.
- Tesztek: unit (`listItems`, `listMoves`, `listCache`), integrációs és jogosultsági (`lists.integration.test.ts`, SSE-vel), E2E (`apps/e2e/tests/lists.spec.ts`).
- Nem része az M8-nak: határidő/emlékeztető, mennyiség/egység, MCP-eszköz (lásd fent).

**UI-fejlesztés (az M8 mellett, kész):**
- Világos/sötét/rendszer téma (design tokenek `tokens.css`, `data-theme`, villanásmentes betöltés, `theme-color` meta); váltó a felhasználói menüben és a parancspalettán.
- Gyors navigáció a felhasználói menüből (táblák, listák, munkaterületek) és parancspaletta (Ctrl/Cmd + K, ékezetfüggetlen keresés).
- Toastok az `alert()` helyett, visszavonás kártya-archiváláskor, listatétel törlésekor és lista archiválásakor.
- Mobilbarát elrendezés: törő fejléc, 44 px-es érintési felületek, biztonságos területek (notch), csökkentett mozgás támogatása, SVG harang ikon, egységes üres állapot.

### M9 – Android: PWA + TWA, GitHub Release (opcionális, még nem ütemezett)

Cél: a webes kliens mobilon is használható, és telepíthető Android appként. Play Store **nem** cél; az APK terjesztése GitHub Releases-en át történik.

- Mobil responsive UI (tábla, kártyamodal, navigáció) és touch drag & drop (hosszú nyomás, görgetés-ütközés kezelése).
- PWA alapok: manifest, maskable ikonok, service worker (app shell cache, offline jelzés), SSE újracsatlakozás háttér/előtér váltáskor.
- TWA csomagolás Bubblewrappel (dev-eszköz, nem repo-függőség), `/.well-known/assetlinks.json` kiszolgálása a `web` konténerből az aláírókulcs SHA-256 ujjlenyomatával.
- GitHub Actions: tag-re (`v*`) aláírt APK build és csatolás a Releasehez; a keystore és a jelszavak csak GitHub Secretsben.
- Frissítés: a webes tartalom a szerverről frissül; az APK-frissítéshez ajánlott az Obtainium.
- Opcionális, később: Web Push (VAPID; új függőség és migráció, egyeztetést igényel), mikrofon/hangasszisztens teszt TWA-ban.
- Becslés: kb. 2 hét.

### M10 – Platform-adminisztráció

Cél: a rendszerszintű felhasználó- és meghívókezelés, valamint a biztonsági események áttekintése egy kizárólag platform-adminok számára látható felületen. Ez nem munkaterületi beállítás: a munkaterületi `owner` és `admin` szerepkör önmagában nem ad platform-admin jogosultságot.

**Elérés és jogosultság:**
- A felhasználói avatar menüjében csak `isAdmin` felhasználónak jelenjen meg az „Adminisztráció” menüpont; az oldal külön `/admin` útvonalon legyen.
- A frontend útvonalvédelme csak kényelmi réteg: minden admin API-végpont sessionnel és szerveroldali platform-admin ellenőrzéssel védett. API-kulcs adminisztrációra nem használható.
- A platform-admin jogosultság nem kerül a munkaterületi szerepkörök közé, és a munkaterületi policy nem terjeszti ki automatikusan.

**Első verzió:**
- Áttekintő: felhasználók és függő meghívók száma, legutóbbi fontos admin-/biztonsági események, valamint az API, az adatbázis és az e-mail-küldés alapvető állapota.
- Felhasználókezelés: név és e-mail szerinti keresés; fiókadatlap a regisztráció idejével, e-mail-megerősítési állapottal és munkaterületi tagságokkal; megerősítő e-mail újraküldése; fiók felfüggesztése és visszaállítása; a felhasználó munkameneteinek visszavonása.
- Platform-admin szerep kiosztása és visszavonása csak platform-admin által, külön megerősítéssel és auditnapló-bejegyzéssel. A rendszer védje ki, hogy az utolsó platform-admin véletlenül elveszítse a hozzáférését.
- Meghívókezelés: a meglévő munkaterületi meghívási folyamat felületre emelése; meghívó küldése e-mail-címmel, munkaterülettel és szerepkörrel; függő, elfogadott, lejárt és visszavont meghívók listázása; újraküldés és visszavonás. A meghívó továbbra is munkaterülethez kötött, a kiosztható szerepkörök és a meglévő szabályok érvényesek.
- Platformszintű auditnapló: adminműveletek és fontos hitelesítési/biztonsági események rögzítése; időszak, eseménytípus, végrehajtó és érintett felhasználó szerinti szűrés. Az esemény legalább a végrehajtót, az időpontot, a műveletet és az érintett erőforrást azonosítsa.
- A meglévő `activity_log` táblához és listához kötött üzleti tevékenységeket naplóz, nem teljes platform-auditnapló; az adminfelülethez külön, célzott auditálás szükséges. Jelszó, session token, meghívótoken, API-kulcs vagy más titok nem kerülhet a naplóba.
- Minden új admin API-szerződéshez közös Zod-séma, OpenAPI-leírás, integrációs teszt és engedélyezett/tiltott jogosultsági teszt szükséges. A módosító adminműveletek idempotencia- és naplózási szabályai is érvényesek.
- Frontend: adminoldal az avatar menüből, felhasználólista/adatlap, meghívólista és auditnapló; minden felirat i18n-kulccsal, a műveletek visszajelzése toasttal, a visszafordíthatatlan vagy érzékeny változtatások külön megerősítéssel.

**Nem része az első verziónak:** részletes analitika, tömeges felhasználókezelés, felhasználóként való belépés (impersonáció), illetve admin által végzett jelszóbeállítás vagy jelszómegtekintés. A felhasználói fiók törlése helyett első körben a felfüggesztés és a munkamenetek visszavonása használandó.

**Kész, ha:** nem-admin felhasználó sem az admin UI-t, sem az admin API-t nem érheti el; a platform-admin kezelni tudja a felhasználók fiókállapotát, munkameneteit és a munkaterületi meghívókat; minden adminmódosítás és fontos biztonsági esemény visszakereshető, érzékeny hitelesítési titok naplózása nélkül.

**Megvalósítás (kész):**
- Jogosultság: `users.is_admin` marad a platform-admin jele; az `auth/actor.ts` `requirePlatformAdmin(actor)` a service-ek első sora minden admin műveletben (API kulcs sosem platform-admin). A `/api/v1/admin/**` útvonalak az `auth/scopes.ts`-ben session-only-k, így kulccsal `403 session_required`. A frontenden az `AdminLayout` csak kényelmi guard.
- Adatmodell (migráció `0013`): `users.suspended_at`, `invitations.revoked_at` és az új `audit_log` tábla (`actor_id`, `action`, `target_type`, `target_id`, `target_user_id`, `ip`, `meta`; a hivatkozások `set null`-ra állnak, így a napló a fiók törlése után is megmarad). A munkaterületi meghívó visszavonása (`DELETE /workspaces/{id}/invitations/{id}`) is `revoked_at`-et állít.
- Felfüggesztés: a felfüggesztett fiók nem léphet be (`403 account_suspended`, csak helyes jelszó után, hogy a fiók létezése ne derüljön ki), a meglévő munkamenetei megszűnnek, a session és az API kulcsai sem érvényesek. Saját fiók nem függeszthető fel (`409 cannot_suspend_self`), és az utolsó aktív platform-adminnak nem vehető el a joga, és nem is függeszthető fel (`409 last_admin`). Admin jogot csak megerősített, nem felfüggesztett fiók kaphat (a platform-admin mentesül az e-mail-megerősítés alól).
- Auditnapló (`modules/audit/`): `AuditService.record({ actorId, action, targetType, targetUserId, ip, meta })`; a műveletek listája a `packages/shared/src/schemas/admin.ts`-ben (`AUDIT_ACTIONS`): `auth.registered`, `auth.login_succeeded`, `auth.login_failed`, `auth.login_blocked`, `auth.password_reset`, `admin.user_suspended|restored|sessions_revoked|admin_granted|admin_revoked|verification_resent`, `admin.invitation_created|resent|revoked`. A `meta` nem tartalmazhat titkot; a sikertelen belépés a megpróbált e-mail-címet rögzíti (jelszót nem). Az ismétlődő állapotváltás (pl. egy már felfüggesztett fiók újabb felfüggesztése) nem ír újabb bejegyzést.
- API (`modules/admin/`, mind session + platform-admin): `GET /admin/overview`; `GET /admin/users` (`q`, `status=all|active|suspended|unverified`, cursor), `GET /admin/users/{id}`, `POST /admin/users/{id}/suspend|restore|revoke-sessions|resend-verification`, `PUT /admin/users/{id}/admin`; `GET /admin/workspaces`; `GET|POST /admin/invitations` (`status=pending|accepted|expired|revoked`), `POST /admin/invitations/{id}/resend`, `DELETE /admin/invitations/{id}`; `GET /admin/audit` (`action`, `actorId`, `targetUserId`, `from`, `to`, cursor). A jelszó nélküli seed felhasználó nem jelenik meg a listán.
- Meghívók: a meghívó tokenje csak hash-ként él, ezért az „újraküldés” új meghívót ad ki (az új levél új tokennel megy ki), a régi lejár. A meghívó vagy platform-regisztrációs (munkaterület nélkül), vagy `workspaceId` + `role` együtt (munkaterületi; az elfogadás a meglévő folyamaton át megy). Az állapot származtatott: `pending`, `accepted`, `revoked`, `expired`.
- Frontend (`features/admin/`, `admin` i18n névtér): `/admin` áttekintő, `/admin/users` (kereső, állapotszűrő, adatlap ablak, érzékeny műveletek `ConfirmModal`-lal, toast visszajelzés), `/admin/invitations` (küldés, állapotszűrő, újraküldés, visszavonás), `/admin/audit` (esemény- és időszak-szűrő, lapozás). Menüpont a felhasználói menüben és a parancspalettán csak platform-adminnak.
- Tesztek: integrációs és jogosultsági (`modules/admin/*.integration.test.ts`, `modules/audit/`: névtelen, sima felhasználó és API kulcs is 401/403), a `scopes.test.ts` bővítve, unit (`adminErrors`, `auditEvents`, `dayRange`), E2E (`apps/e2e/tests/admin.spec.ts`: az első regisztrált felhasználó az admin, ezért a fájl ábécésorban az első).
- Nem része az M10-nek: az auditnapló szűrése végrehajtó/érintett felhasználó szerint a felületen (az API támogatja), aktív munkamenetek listázása egyenként, az auditnapló megőrzési ideje és exportja.

## 4. Keresztmetszeti szabályok (minden sprintben)

- Minden új végpont: Zod séma a `shared`-ben, integrációs teszt, jogosultsági teszt és OpenAPI-leírás.
- Minden új UI-szöveg fordítási kulccsal kerül be; a backend hibakódot ad vissza, nem szöveget.
- „Definition of Done”: lint + typecheck + teszt + build zöld, és nincs logika a route/komponens rossz rétegében.
- Migráció csak előre (a drizzle-kit generál), seed idempotens.
- Titkok csak `.env`-ben (`.env.example` commitolva).
- Kis, fókuszált commitok; a `main` mindig buildelhető.

## 5. Kockázatok és nyitott kérdések

| Téma | Megjegyzés |
|---|---|
| SQLite skálázhatóság | Egy szerverpéldány mellett jó; több példány vagy nagy írási terhelés esetén Postgres. Drizzle miatt alacsony váltási költség. |
| Gemini Live | A Gemini API kulcs csak a szerveren élhet (`.env`); a hang-végpont session-only, és felhasználónként korlátozni kell az egyidejű munkameneteket. A Live API használata költséggel jár. |
| Gmail SMTP | Napi ~500 levél limit; a Google bármikor szigoríthat. A `Mailer` interfész miatt a csere (pl. Brevo, Resend, SES) egy új implementáció + env-módosítás. Az app password kizárólag `.env`-ben lehet. |
| Házi szerver | Áramszünet vagy hardverhiba esetén nincs redundancia: a mentést a szerveren kívülre is ki kell vinni (pl. másik gép vagy felhő). |
| Cloudflare Tunnel | SSE-nél és a hangasszisztens WebSocketjénél heartbeat/ping kell (az nginx-nek upgrade fejléc és hosszú timeout); nagy fájlfeltöltésnél a Cloudflare free csomag 100 MB-os kéréslimitje érvényes. |

**Lezárt döntések:** TypeScript; a stack függőségei jóváhagyva; Gmail app password; Docker Compose + cloudflared a házi szerveren, saját domainnel; egyelőre csak magyar, i18n-re felkészítve.
