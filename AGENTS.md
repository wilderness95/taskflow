# TaskFlow – agent szabályok

Trello-klón kollaborációval, felhasználókezeléssel és API-kulcsos hozzáféréssel (AI agentekhez).
A teljes terv és a mérföldkövek: `docs/ROADMAP.md`. Az ott rögzített döntéseket kövesd.

## Projekt és stack
- **Nyelv: TypeScript** mindenhol (`strict: true`). Új kód `.ts` / `.tsx`; `any` csak indokolt esetben, kommenttel.
- npm workspaces monorepo; csomagkezelő: npm (`package-lock.json`). Ne használj yarn/pnpm-et.
  - `apps/web`: React 19 + Vite, i18next (megvan); TanStack Query, React Router (megvan).
  - `apps/api`: Node.js + Fastify, Drizzle ORM, SQLite (WAL), Zod, Nodemailer, argon2 (megvan).
  - `packages/shared`: tiszta segédfüggvények, típusok, enumok (megvan); Zod sémák, DTO-k (megvan); hibakódok (tervezett).
- Üzemeltetés: Docker Compose (`web` + `api` + `cloudflared`) a házi szerveren, Cloudflare Tunnelen, saját domainnel.
- Aktuális állapot: az M0 (refaktor), az M1 (backend, perzisztencia, API, Docker Compose) és az M2 (felhasználókezelés, authentikáció) kész; az M3 (munkaterületek, tagság, authorizáció) készül az `m3-workspaces` branchen. Az API-hoz bejelentkezés kell (session cookie); a hozzáférést a munkaterületi és tábla-szerepkörök adják (policy: `packages/shared/src/authz.ts`).

## Parancsok
- Fejlesztés: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint` (oxlint, konfig: `.oxlintrc.json`)
- Typecheck: `npm run typecheck`; tesztek: `npm test` (Vitest); formázás: `npm run format` / `npm run format:check` (Prettier)
- Változtatás után mindig futtasd a lintet, a format-ellenőrzést, a typechecket, a teszteket és a buildet, és javítsd a hibákat. A CI (`.github/workflows/ci.yml`) ugyanezt futtatja.

## Architektúra és rétegek
- **Backend modulonként:** `*.routes.ts` → `*.service.ts` → `*.repository.ts`. A függés csak ebben az irányban mehet.
  - **Route:** HTTP, séma-validáció, auth guard; nincs benne üzleti logika.
  - **Service:** üzleti logika és jogosultság-ellenőrzés a központi policy-val (`can(actor, action, resource)`, a `packages/shared`-ben, a service-ek az `AccessService`-en át hívják); nincs benne SQL és HTTP-objektum.
  - **Repository:** csak DB-hozzáférés (Drizzle).
- Session és API kulcs egyaránt `Actor`-rá képződik le; a service nem tudja, honnan jön a kérés.
- Minden API-szerződés (request/response) Zod sémája a `packages/shared`-ben van; a frontend és a backend is ezt használja.
- **Frontend:** feature-alapú mappák (`features/<feature>/`); közös UI a `shared/` alatt. Komponens nem hív közvetlenül `fetch`-et, csak az `api/` kliensen és a TanStack Query hookokon keresztül.
- DB-séma változás csak migrációval (`drizzle-kit generate`); a migrációk csak előre mennek, a meglévőket ne írd át.
- ID-k: ULID/UUIDv7. Sorrend: fractional indexing (`position`).

## API szabályok (AI agent kompatibilitás)
- REST, `/api/v1/...`, egységes hibaformátum: `{ error: { code, message, details } }`.
- Minden új végponthoz kell: Zod séma, OpenAPI-leírás, integrációs teszt és jogosultsági teszt (a megengedett és a tiltott eset is).
- API kulcs: csak a hash-e tárolható; a scope-ok és a tulajdonos jogainak metszete érvényes.
- Írási műveletek naplózása az `activity_log`-ba (actor-típussal).

## Többnyelvűség (i18n)
Egyelőre csak magyar UI van, de a kódnak fordításra késznek kell lennie:
- **Nincs beégetett UI-szöveg** komponensben: felirat, placeholder, `aria-label`, toast, confirm mind `t('namespace:kulcs')`.
- A fordítások helye: `apps/web/src/i18n/locales/hu/<namespace>.json`, névterek feature-önként. A magyar fájl a kulcsok forrása (típusbiztos).
- Dátum és szám csak a központi `format` helperekkel; tilos a beégetett `'hu-HU'` vagy a közvetlen `toLocale*`.
- Többes szám és változók az i18next interpolációval; tilos a string-összefűzés.
- A backend nem küld megjelenítendő szöveget: hibakód + paraméterek, a fordítás a frontenden történik.
- A DB-ben az enumok nyelvfüggetlenek (`high`/`medium`/`low`), nem magyar szavak.
- E-mail sablonok: `apps/api/src/i18n/locales/<lang>.ts`.
- A felhasználói tartalom (kártya, tábla, címke szövege) nem fordítandó.

## Kódstílus
- Funkcionális komponensek és hookok; class komponens nem.
- Egy komponens = egy fájl, PascalCase fájlnév (`TaskCard.tsx`). Hookok: `useXxx.ts`.
- A komponens maradjon kicsi (~150 sor felett bontsd szét); összetett állapothoz `useReducer` vagy egyedi hook.
- 2 szóköz behúzás, ES modulok, Prettier-formázás; kövesd a meglévő stílust.
- **Stílus:** a komponens CSS-e mellette él (`TaskCard.tsx` + `TaskCard.css`), a komponens importálja. A több helyen használt osztályok a `shared/styles/` alatt vannak. Az osztálynevek globálisak: új osztály legyen komponens-specifikus, és ne ütközzön meglévővel. A `*.css` fájlokat a Prettier nem formázza.
- Tiszta függvényekhez (formázás, számítás) unit teszt.
- Új függőség: a `docs/ROADMAP.md`-ben felsorolt stack jóváhagyott. Ami azon kívül esik, azt a felhasználóval egyeztetni kell.

## Biztonság és konfiguráció
- Titok (Gmail app password, session secret, tunnel token, API kulcs) **soha** nem kerülhet a repóba, logba vagy tesztfixture-be. Csak `.env`; az új változókat a `.env.example`-ben dokumentáld (érték nélkül).
- Az app Cloudflare mögött fut: a kliens IP-je a `CF-Connecting-IP` fejlécből jön; a cookie `Secure` + `HttpOnly` + `SameSite=Lax`; Origin-ellenőrzés az `APP_URL` alapján.
- Jelszó: argon2. Token vagy kulcs: csak hash tárolható.

## Git szabályok
- Lokális commit engedély nélkül megengedett.
- **Push (`git push`) KIZÁRÓLAG a felhasználó kifejezett engedélyével.**
- Ne módosítsd a `git config`-ot, ne használj `--amend`-et, force-pusht vagy `--no-verify`-t, hacsak a felhasználó nem kéri.
- Commit előtt nézd át: `git status`, `git diff`; csak a szándékolt fájlokat stage-eld, titkokat (`.env`, `*.db`) soha.
- Commit üzenet: rövid, felszólító módú, a változás lényegét leíró. Lehetőleg egy logikai változás = egy commit.
