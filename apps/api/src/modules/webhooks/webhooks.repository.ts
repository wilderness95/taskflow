import { eq } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { webhooks } from '../../db/schema.js'

export type WebhookRow = typeof webhooks.$inferSelect

export function createWebhooksRepository(db: Db) {
  return {
    findById: (id: string): WebhookRow | undefined =>
      db.select().from(webhooks).where(eq(webhooks.id, id)).get(),
    listForBoard: (boardId: string): WebhookRow[] =>
      db.select().from(webhooks).where(eq(webhooks.boardId, boardId)).orderBy(webhooks.id).all(),
    insert: (values: typeof webhooks.$inferInsert): WebhookRow =>
      db.insert(webhooks).values(values).returning().get(),
    update: (id: string, values: Partial<typeof webhooks.$inferInsert>): WebhookRow | undefined =>
      db.update(webhooks).set(values).where(eq(webhooks.id, id)).returning().get(),
    delete: (id: string): void => {
      db.delete(webhooks).where(eq(webhooks.id, id)).run()
    },
  }
}
export type WebhooksRepository = ReturnType<typeof createWebhooksRepository>
