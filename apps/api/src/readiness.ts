import { access, constants } from 'node:fs/promises'
import path from 'node:path'
import { sql } from 'drizzle-orm'
import type { Db } from './db/client.js'
import type { ReadinessCheck } from './health.routes.js'

/** Az útvonal (vagy, ha még nem jött létre, a szülőkönyvtára) írható-e. */
async function writable(dir: string): Promise<boolean> {
  for (const candidate of [dir, path.dirname(dir)]) {
    try {
      await access(candidate, constants.W_OK)
      return true
    } catch {
      // a következő jelölt
    }
  }
  return false
}

/**
 * A `/readyz` ellenőrzései: az adatbázis válaszol és a migrációk lefutottak; a helyi feltöltési
 * könyvtár írható (csak akkor, ha az app a helyi fájltárat használja).
 */
export function readinessChecks(db: Db, uploadDir: string, localStore: boolean): ReadinessCheck[] {
  const checks: ReadinessCheck[] = [
    { name: 'database', run: () => db.get<{ ok: number }>(sql`select 1 as ok`)?.ok === 1 },
    {
      name: 'migrations',
      run: () =>
        (db.get<{ n: number }>(sql`select count(*) as n from __drizzle_migrations`)?.n ?? 0) > 0,
    },
  ]
  if (localStore) checks.push({ name: 'storage', run: () => writable(uploadDir) })
  return checks
}
