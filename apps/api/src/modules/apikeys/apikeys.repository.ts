import { and, desc, eq } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { apiKeys } from '../../db/schema.js'

export type ApiKeyRow = typeof apiKeys.$inferSelect

export function createApiKeysRepository(db: Db) {
  return {
    insert: (values: typeof apiKeys.$inferInsert): ApiKeyRow =>
      db.insert(apiKeys).values(values).returning().get(),
    listForUser: (userId: string): ApiKeyRow[] =>
      db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId))
        .orderBy(desc(apiKeys.createdAt), desc(apiKeys.id))
        .all(),
    findByHash: (keyHash: string): ApiKeyRow | undefined =>
      db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).get(),
    findOwned: (id: string, userId: string): ApiKeyRow | undefined =>
      db
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
        .get(),
    update: (id: string, values: Partial<typeof apiKeys.$inferInsert>): ApiKeyRow | undefined =>
      db.update(apiKeys).set(values).where(eq(apiKeys.id, id)).returning().get(),
  }
}
export type ApiKeysRepository = ReturnType<typeof createApiKeysRepository>
