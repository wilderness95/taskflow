import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { cardLabels, cards } from '../../db/schema.js'

export type CardRow = typeof cards.$inferSelect

export function createCardsRepository(db: Db) {
  return {
    findById: (id: string): CardRow | undefined =>
      db
        .select()
        .from(cards)
        .where(and(eq(cards.id, id), isNull(cards.archivedAt)))
        .get(),
    listByColumnIds: (columnIds: string[]): CardRow[] =>
      columnIds.length === 0
        ? []
        : db
            .select()
            .from(cards)
            .where(and(inArray(cards.columnId, columnIds), isNull(cards.archivedAt)))
            .orderBy(asc(cards.position))
            .all(),
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
