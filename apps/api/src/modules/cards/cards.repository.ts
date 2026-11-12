import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lte, or, sql } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { cardAssignees, cardLabels, cards, columns } from '../../db/schema.js'

export type CardRow = typeof cards.$inferSelect
export type CardFilter = {
  columnId?: string
  priority?: CardRow['priority']
  labelId?: string
  assigneeId?: string
  dueBefore?: string
  dueAfter?: string
  q?: string
}

/** LIKE-minta a részszövegkereséshez (a `%`, `_` és `!` jelentése kikapcsolva; `ESCAPE '!'`). */
const likePattern = (q: string) => `%${q.replace(/[!%_]/g, '!$&')}%`

export function createCardsRepository(db: Db) {
  return {
    findById: (id: string): CardRow | undefined =>
      db
        .select()
        .from(cards)
        .where(and(eq(cards.id, id), isNull(cards.archivedAt)))
        .get(),
    /** Archivált is (a visszaállításhoz és az archívum nézethez). */
    findAnyById: (id: string): CardRow | undefined =>
      db.select().from(cards).where(eq(cards.id, id)).get(),
    listArchivedForBoard: (boardId: string): CardRow[] =>
      db
        .select({ card: cards })
        .from(cards)
        .innerJoin(columns, eq(columns.id, cards.columnId))
        .where(and(eq(columns.boardId, boardId), isNotNull(cards.archivedAt)))
        .orderBy(desc(cards.archivedAt))
        .all()
        .map((r) => r.card),
    listByColumnIds: (columnIds: string[]): CardRow[] =>
      columnIds.length === 0
        ? []
        : db
            .select()
            .from(cards)
            .where(and(inArray(cards.columnId, columnIds), isNull(cards.archivedAt)))
            .orderBy(asc(cards.position))
            .all(),
    /** Egy tábla kártyái szűrve, ID szerint növekvő sorrendben (`afterId`: a lapozás kurzora). */
    listForBoard: (
      boardId: string,
      filter: CardFilter,
      limit: number,
      afterId?: string,
    ): CardRow[] =>
      db
        .select({ card: cards })
        .from(cards)
        .innerJoin(columns, eq(columns.id, cards.columnId))
        .where(
          and(
            eq(columns.boardId, boardId),
            isNull(cards.archivedAt),
            isNull(columns.archivedAt),
            afterId ? gt(cards.id, afterId) : undefined,
            filter.columnId ? eq(cards.columnId, filter.columnId) : undefined,
            filter.priority ? eq(cards.priority, filter.priority) : undefined,
            filter.labelId
              ? sql`exists (select 1 from ${cardLabels} where ${cardLabels.cardId} = ${cards.id} and ${cardLabels.labelId} = ${filter.labelId})`
              : undefined,
            filter.assigneeId
              ? sql`exists (select 1 from ${cardAssignees} where ${cardAssignees.cardId} = ${cards.id} and ${cardAssignees.userId} = ${filter.assigneeId})`
              : undefined,
            filter.dueBefore ? lte(cards.dueDate, filter.dueBefore) : undefined,
            filter.dueAfter ? gte(cards.dueDate, filter.dueAfter) : undefined,
            filter.q
              ? or(
                  sql`${cards.title} like ${likePattern(filter.q)} escape '!'`,
                  sql`${cards.description} like ${likePattern(filter.q)} escape '!'`,
                )
              : undefined,
          ),
        )
        .orderBy(asc(cards.id))
        .limit(limit)
        .all()
        .map((r) => r.card),
    labelIdsByCard: (cardIds: string[]): Map<string, string[]> => {
      const map = new Map<string, string[]>()
      if (cardIds.length === 0) return map
      for (const r of db
        .select()
        .from(cardLabels)
        .where(inArray(cardLabels.cardId, cardIds))
        .all()) {
        map.set(r.cardId, [...(map.get(r.cardId) ?? []), r.labelId])
      }
      return map
    },
    assigneeIdsByCard: (cardIds: string[]): Map<string, string[]> => {
      const map = new Map<string, string[]>()
      if (cardIds.length === 0) return map
      for (const r of db
        .select()
        .from(cardAssignees)
        .where(inArray(cardAssignees.cardId, cardIds))
        .orderBy(sql`rowid`)
        .all()) {
        map.set(r.cardId, [...(map.get(r.cardId) ?? []), r.userId])
      }
      return map
    },
    setAssignees: (cardId: string, userIds: string[]): void => {
      db.delete(cardAssignees).where(eq(cardAssignees.cardId, cardId)).run()
      if (userIds.length > 0) {
        db.insert(cardAssignees)
          .values(userIds.map((userId) => ({ cardId, userId })))
          .run()
      }
    },
    listPositions: (columnId: string): { id: string; position: string }[] =>
      db
        .select({ id: cards.id, position: cards.position })
        .from(cards)
        .where(and(eq(cards.columnId, columnId), isNull(cards.archivedAt)))
        .orderBy(asc(cards.position))
        .all(),
    lastPosition: (columnId: string): string | null =>
      db
        .select({ position: cards.position })
        .from(cards)
        .where(eq(cards.columnId, columnId))
        .orderBy(desc(cards.position))
        .limit(1)
        .get()?.position ?? null,
    insert: (values: typeof cards.$inferInsert): CardRow =>
      db.insert(cards).values(values).returning().get(),
    update: (id: string, values: Partial<typeof cards.$inferInsert>): CardRow | undefined =>
      db.update(cards).set(values).where(eq(cards.id, id)).returning().get(),
    delete: (id: string): void => {
      db.delete(cards).where(eq(cards.id, id)).run()
    },
    setLabels: (cardId: string, labelIds: string[]): void => {
      db.delete(cardLabels).where(eq(cardLabels.cardId, cardId)).run()
      if (labelIds.length > 0) {
        db.insert(cardLabels)
          .values(labelIds.map((labelId) => ({ cardId, labelId })))
          .run()
      }
    },
    transaction: <T>(fn: () => T): T => db.transaction(fn),
  }
}
export type CardsRepository = ReturnType<typeof createCardsRepository>
