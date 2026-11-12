import { and, asc, eq, gt, inArray } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { commentMentions, comments, users } from '../../db/schema.js'

export type CommentRow = typeof comments.$inferSelect & {
  authorName: string
  authorAvatarUrl: string | null
}

const selection = {
  id: comments.id,
  cardId: comments.cardId,
  authorId: comments.authorId,
  apiKeyId: comments.apiKeyId,
  viaApiKey: comments.viaApiKey,
  body: comments.body,
  editedAt: comments.editedAt,
  createdAt: comments.createdAt,
  authorName: users.name,
  authorAvatarUrl: users.avatarUrl,
}

export function createCommentsRepository(db: Db) {
  const base = () =>
    db.select(selection).from(comments).innerJoin(users, eq(users.id, comments.authorId))

  return {
    findById: (id: string): CommentRow | undefined => base().where(eq(comments.id, id)).get(),
    /** Egy kártya hozzászólásai időrendben (ID szerint növekvő); `afterId`: a lapozás kurzora. */
    listForCard: (cardId: string, limit: number, afterId?: string): CommentRow[] =>
      base()
        .where(and(eq(comments.cardId, cardId), afterId ? gt(comments.id, afterId) : undefined))
        .orderBy(asc(comments.id))
        .limit(limit)
        .all(),
    insert: (values: typeof comments.$inferInsert): void => {
      db.insert(comments).values(values).run()
    },
    update: (id: string, values: Partial<typeof comments.$inferInsert>): void => {
      db.update(comments).set(values).where(eq(comments.id, id)).run()
    },
    delete: (id: string): void => {
      db.delete(comments).where(eq(comments.id, id)).run()
    },
    mentionIdsByComment: (commentIds: string[]): Map<string, string[]> => {
      const map = new Map<string, string[]>()
      if (commentIds.length === 0) return map
      for (const r of db
        .select()
        .from(commentMentions)
        .where(inArray(commentMentions.commentId, commentIds))
        .all()) {
        map.set(r.commentId, [...(map.get(r.commentId) ?? []), r.userId])
      }
      return map
    },
    setMentions: (commentId: string, userIds: string[]): void => {
      db.delete(commentMentions).where(eq(commentMentions.commentId, commentId)).run()
      if (userIds.length > 0) {
        db.insert(commentMentions)
          .values(userIds.map((userId) => ({ commentId, userId })))
          .run()
      }
    },
    transaction: <T>(fn: () => T): T => db.transaction(fn),
  }
}
export type CommentsRepository = ReturnType<typeof createCommentsRepository>
