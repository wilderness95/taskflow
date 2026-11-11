import { asc, count, desc, eq } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { cards, columns } from '../../db/schema.js'

export type ColumnRow = typeof columns.$inferSelect

export function createColumnsRepository(db: Db) {
  return {
    findById: (id: string): ColumnRow | undefined =>
      db.select().from(columns).where(eq(columns.id, id)).get(),
    update: (id: string, values: Partial<typeof columns.$inferInsert>): ColumnRow | undefined =>
      db.update(columns).set(values).where(eq(columns.id, id)).returning().get(),
    delete: (id: string): void => {
      db.delete(columns).where(eq(columns.id, id)).run()
    },
    listPositions: (boardId: string): { id: string; position: string }[] =>
      db
        .select({ id: columns.id, position: columns.position })
        .from(columns)
        .where(eq(columns.boardId, boardId))
        .orderBy(asc(columns.position))
        .all(),
    countCards: (id: string): number =>
      db.select({ n: count() }).from(cards).where(eq(cards.columnId, id)).get()?.n ?? 0,
    cardIdsInOrder: (id: string): string[] =>
      db
        .select({ id: cards.id })
        .from(cards)
        .where(eq(cards.columnId, id))
        .orderBy(asc(cards.position))
        .all()
        .map((r) => r.id),
    lastCardPosition: (id: string): string | null =>
      db
        .select({ position: cards.position })
        .from(cards)
        .where(eq(cards.columnId, id))
        .orderBy(desc(cards.position))
        .limit(1)
        .get()?.position ?? null,
    moveCard: (cardId: string, columnId: string, position: string): void => {
      db.update(cards).set({ columnId, position }).where(eq(cards.id, cardId)).run()
    },
    transaction: <T>(fn: () => T): T => db.transaction(fn),
  }
}
export type ColumnsRepository = ReturnType<typeof createColumnsRepository>
