# TaskFlow API – Getting started for agents

Az API REST, JSON, alap: `https://<domain>/api/v1`. A teljes leírás OpenAPI 3.1 formában:

- élő: `GET /api/openapi.json`, Swagger UI: `/api/docs`
- exportált példány a repóban: [`docs/openapi.json`](openapi.json) (újragenerálás: `npm run openapi:export -w @taskflow/api`)

## 1. API kulcs létrehozása

Böngészőben: **Beállítások → API kulcsok → Új kulcs**. Add meg a nevét, a hatóköröket és (opcionálisan) a lejáratot.
A kulcs (`tfk_...`) **csak létrehozáskor látszik**, utána csak az eleje (prefix). A kulcs kezelése csak bejelentkezett
(böngészős) munkamenettel lehetséges, kulccsal nem.

| Hatókör           | Mit enged                                                              |
| ----------------- | ---------------------------------------------------------------------- |
| `workspaces:read` | munkaterületek és tagjaik listázása                                    |
| `boards:read`     | táblák, oszlopok, kártyák, checklistek, tevékenységnapló, snapshot olvasása |
| `boards:write`    | tábla-tartalom írása (táblák, oszlopok, kártyák, checklistek, címkék); az olvasást is magában foglalja |

A kulcs tényleges joga a **hatókör és a tulajdonos jogainak metszete**: ha a tulajdonos csak olvasó (`viewer`) egy
táblán, a `boards:write` kulcsa sem írhat oda. Amit a tulajdonos nem lát, az a kulcsnak sem létezik (404).
Fiók-, tagság-, meghívó- és kulcskezelő végpontok kulccsal nem érhetők el (`403 session_required`).

```sh
export TF=https://taskflow.example.com/api/v1
export KEY=tfk_...
```

## 2. Hitelesítés

`Authorization: Bearer <kulcs>` fejléc minden kérésen.

```sh
curl -H "Authorization: Bearer $KEY" $TF/auth/me
curl -H "Authorization: Bearer $KEY" $TF/workspaces
```

| Státusz | Kód                  | Jelentés                                              |
| ------- | -------------------- | ----------------------------------------------------- |
| 401     | `invalid_api_key`    | ismeretlen, visszavont vagy lejárt kulcs              |
| 403     | `insufficient_scope` | a kulcs hatóköre nem elég (`details.required`)        |
| 403     | `forbidden`          | a tulajdonos jogai nem elegendők a művelethez         |
| 403     | `session_required`   | csak böngészős bejelentkezéssel elérhető végpont      |
| 404     | `not_found`          | nem létezik, vagy a tulajdonos nem láthatja           |
| 429     | `rate_limited`       | kulcsonkénti limit (`Retry-After` fejléc)             |

Hibaformátum mindig: `{ "error": { "code": "...", "message": "...", "details": ... } }`. A `code` géppel olvasható, a
`message` nem fordítandó/stabil szöveg.

## 3. Áttekintés egy kéréssel: snapshot

```sh
curl -H "Authorization: Bearer $KEY" $TF/boards/$BOARD_ID/snapshot
```

Tömör összefoglaló: oszlopok és kártyák (cím, prioritás, határidő, `overdue`, címkenevek, checklist-állás, a leírás
eleje), statisztika és a legutóbbi 10 tevékenység. Táblák listája: `GET /boards` vagy `GET /workspaces/{id}/boards`.

## 4. Kártya létrehozása és áthelyezése

```sh
# kártya létrehozása az oszlop végére
curl -X POST $TF/columns/$TODO_COLUMN_ID/cards \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"title":"Hibajavítás","priority":"high","dueDate":"2030-01-31"}'

# áthelyezés másik oszlopba (a végére; `beforeCardId`-val egy kártya elé)
curl -X POST $TF/cards/$CARD_ID/move \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"columnId":"'$DONE_COLUMN_ID'"}'

# módosítás
curl -X PATCH $TF/cards/$CARD_ID \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"description":"Kész, a tesztek zöldek."}'
```

Enumok nyelvfüggetlenek: prioritás `high` / `medium` / `low`; dátum `YYYY-MM-DD`. Az azonosítók ULID-ek.

## 5. Biztonságos újrapróbálás: `Idempotency-Key`

Minden író kérésen (`POST`, `PUT`, `PATCH`, `DELETE`) küldhető `Idempotency-Key` fejléc (1–255 nyomtatható ASCII
karakter, pl. UUID). Ugyanaz a kulcs ugyanazzal a kéréssel az **eltárolt választ** adja vissza
(`Idempotent-Replayed: true`), a művelet nem fut le újra – hálózati hiba után nyugodtan újrapróbálható. Más tartalmú
kéréssel újrahasznált kulcs `422 idempotency_key_reuse`; a még futó eredeti kérés `409 idempotency_in_progress`.
A válaszok 24 óráig őrződnek; 5xx és 429 válasz nem tárolódik.

## 6. Lapozás és szűrés

```sh
curl -H "Authorization: Bearer $KEY" \
  "$TF/boards/$BOARD_ID/cards?priority=high&dueBefore=2030-01-31&limit=50"
```

Szűrők: `columnId`, `priority`, `labelId`, `dueBefore`, `dueAfter` (bezárólag), `q` (részszöveg a címben/leírásban).
A válasz `{ "data": [...], "nextCursor": "..." }`; a következő oldal: `&cursor=<nextCursor>`, a `nextCursor: null` az utolsó
oldal. `limit`: 1–200 (alapértelmezés: 50). Ugyanígy lapozható a `GET /boards/{id}/activity`.

## 7. Tevékenységnapló

Minden írás naplózódik; `GET /boards/{id}/activity` megmutatja, ki végezte (`actorType`: `user` vagy `api_key`,
`apiKeyId`, `actorName`), mit (`action`, pl. `card.moved`) és mivel (`entityType`, `entityId`, `meta`).

## 8. Korlátok

- Kulcsonként percenként legfeljebb `API_KEY_RATE_LIMIT_MAX` kérés (alapértelmezés: 120); a `X-RateLimit-Limit` és
  `X-RateLimit-Remaining` fejléc mutatja az állást. Túllépés után `429` és `Retry-After`.
- A visszavont kulcs azonnal érvénytelen. Kulcsot gyanú esetén vonj vissza, és hozz létre újat.
- A kulcsot ne tedd repóba, logba vagy promptba; csak környezeti változóban tartsd.
