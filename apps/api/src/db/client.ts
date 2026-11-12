import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { backfillWorkspaces } from './backfill.js'
import * as schema from './schema.js'

export type Db = ReturnType<typeof createDb>['db']

/** `:memory:` esetén in-memory adatbázis (tesztekhez). */
export function createDb(url: string) {
  if (url !== ':memory:') mkdirSync(dirname(url), { recursive: true })
  const sqlite = new Database(url)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  return { db, sqlite }
}

export const MIGRATIONS_FOLDER = new URL('../../drizzle', import.meta.url).pathname

export function runMigrations(db: Db): void {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
  backfillWorkspaces(db)
}
