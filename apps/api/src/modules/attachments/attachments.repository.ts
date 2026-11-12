import { asc, eq, inArray, sql } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { attachments } from '../../db/schema.js'

export type AttachmentRow = typeof attachments.$inferSelect

export function createAttachmentsRepository(db: Db) {
  return {
    findById: (id: string): AttachmentRow | undefined =>
      db.select().from(attachments).where(eq(attachments.id, id)).get(),
    listForCard: (cardId: string): AttachmentRow[] =>
      db
        .select()
        .from(attachments)
        .where(eq(attachments.cardId, cardId))
        .orderBy(asc(attachments.id))
        .all(),
    countByCard: (cardIds: string[]): Map<string, number> => {
      if (cardIds.length === 0) return new Map()
      return new Map(
        db
          .select({ cardId: attachments.cardId, n: sql<number>`count(*)` })
          .from(attachments)
          .where(inArray(attachments.cardId, cardIds))
          .groupBy(attachments.cardId)
          .all()
          .map((r) => [r.cardId, r.n]),
      )
    },
    insert: (values: typeof attachments.$inferInsert): AttachmentRow =>
      db.insert(attachments).values(values).returning().get(),
    delete: (id: string): void => {
      db.delete(attachments).where(eq(attachments.id, id)).run()
    },
  }
}
export type AttachmentsRepository = ReturnType<typeof createAttachmentsRepository>
