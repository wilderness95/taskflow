import { and, eq, lt } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { idempotencyKeys } from '../../db/schema.js'

export type IdempotencyRow = typeof idempotencyKeys.$inferSelect

export function createIdempotencyRepository(db: Db) {
  return {
    find: (userId: string, key: string): IdempotencyRow | undefined =>
      db
        .select()
        .from(idempotencyKeys)
        .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key)))
        .get(),
    /** Foglalás: `false`, ha a kulcs közben már létezik (versenyhelyzet). */
    reserve: (userId: string, key: string, fingerprint: string): boolean =>
      db.insert(idempotencyKeys).values({ userId, key, fingerprint }).onConflictDoNothing().run()
        .changes === 1,
    complete: (userId: string, key: string, status: number, response: string): void => {
      db.update(idempotencyKeys)
        .set({ status, response })
        .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key)))
        .run()
    },
    release: (userId: string, key: string): void => {
      db.delete(idempotencyKeys)
        .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key)))
        .run()
    },
    deleteOlderThan: (date: Date): void => {
      db.delete(idempotencyKeys).where(lt(idempotencyKeys.createdAt, date)).run()
    },
  }
}
export type IdempotencyRepository = ReturnType<typeof createIdempotencyRepository>
