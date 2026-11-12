import { and, desc, eq, lt } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { activityLog, users } from '../../db/schema.js'

export type ActivityRow = typeof activityLog.$inferSelect & { actorName: string | null }

export function createActivityRepository(db: Db) {
  return {
    insert: (values: typeof activityLog.$inferInsert): void => {
      db.insert(activityLog).values(values).run()
    },
    /** Egy tábla naplója, legújabb elöl; `beforeId`: a kurzor (az ID-k időrendben növekvők). */
    listForBoard: (boardId: string, limit: number, beforeId?: string): ActivityRow[] =>
      db
        .select({
          id: activityLog.id,
          boardId: activityLog.boardId,
          workspaceId: activityLog.workspaceId,
          actorType: activityLog.actorType,
          actorId: activityLog.actorId,
          apiKeyId: activityLog.apiKeyId,
          action: activityLog.action,
          entityType: activityLog.entityType,
          entityId: activityLog.entityId,
          meta: activityLog.meta,
          createdAt: activityLog.createdAt,
          actorName: users.name,
        })
        .from(activityLog)
        .leftJoin(users, eq(users.id, activityLog.actorId))
        .where(
          and(
            eq(activityLog.boardId, boardId),
            beforeId ? lt(activityLog.id, beforeId) : undefined,
          ),
        )
        .orderBy(desc(activityLog.id))
        .limit(limit)
        .all(),
  }
}
export type ActivityRepository = ReturnType<typeof createActivityRepository>
