# TaskFlow – agent szabályok

## Projekt
- React 19 + Vite 8, sima JavaScript (JSX), TypeScript nélkül.
- Belépési pont: `src/main.jsx`, fő komponens: `src/App.jsx`, stílusok: `src/*.css`.
- Csomagkezelő: npm (`package-lock.json`). Ne használj yarn/pnpm-et.

## Parancsok
- Fejlesztői szerver: `npm run dev`
- Build: `npm run build`
- Lint: `npm run lint` (oxlint, konfig: `.oxlintrc.json`)
- Változtatás után mindig futtasd a `npm run lint` és `npm run build` parancsot, és javítsd a hibákat.

## Kódstílus
- Funkcionális komponensek és hookok; class komponens nem.
- Egy komponens = egy fájl, PascalCase fájlnév (`TaskCard.jsx`).
- Meglévő formázást kövesd (2 szóköz behúzás, ES modulok).
- Új függőséget csak indokolt esetben, a felhasználóval egyeztetve adj hozzá.

## Git szabályok
- Lokális commit engedély nélkül megengedett.
- **Push (`git push`) KIZÁRÓLAG a felhasználó kifejezett engedélyével.**
- Ne módosítsd a `git config`-ot, ne használj `--amend`-et, force-pusht vagy `--no-verify`-t, hacsak a felhasználó nem kéri.
- Commit előtt nézd át: `git status`, `git diff`; csak a szándékolt fájlokat stage-eld, titkokat soha.
- Commit üzenet: rövid, felszólító módú, a változás lényegét leíró.
