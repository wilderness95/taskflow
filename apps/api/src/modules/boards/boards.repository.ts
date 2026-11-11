import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { boards, columns, labels } from '../../db/schema.js'

export type BoardRow = typeof boards.$inferSelect
export type ColumnRow = typeof columns.$inferSelect
export type LabelRow = typeof labels.$inferSelect

export function createBoardsRepository(db: Db) {
  return {
    listActive: (): BoardRow[] =>
      db.select().from(boards).where(isNull(boards.archivedAt)).orderBy(asc(boards.id)).all(),
    findActive: (id: string): BoardRow | undefined =>
      db
        .select()
        .from(boards)
        .where(and(eq(boards.id, id), isNull(boards.archivedAt)))
        .get(),
    insert: (values: typeof boards.$inferInsert): BoardRow =>
      db.insert(boards).values(values).returning().get(),
    update: (id: string, values: Partial<typeof boards.$inferInsert>): BoardRow | undefined =>
      db.update(boards).set(values).where(eq(boards.id, id)).returning().get(),
    listColumns: (boardId: string): ColumnRow[] =>
      db
        .select()
        .from(columns)
        .where(eq(columns.boardId, boardId))
        .orderBy(asc(columns.position))
        .all(),
    listLabels: (boardId: string): LabelRow[] =>
      db.select().from(labels).where(eq(labels.boardId, boardId)).orderBy(asc(labels.id)).all(),
    findLabels: (boardId: string, ids: string[]): LabelRow[] =>
      ids.length === 0
        ? []
        : db
            .select()
            .from(labels)
            .where(and(eq(labels.boardId, boardId), inArray(labels.id, ids)))
            .all(),
    insertLabel: (values: typeof labels.$inferInsert): LabelRow =>
      db.insert(labels).values(values).returning().get(),
    lastColumnPosition: (boardId: string): string | null =>
      db
        .select({ position: columns.position })
        .from(columns)
        .where(eq(columns.boardId, boardId))
        .orderBy(desc(columns.position))
        .limit(1)
        .get()?.position ?? null,
    insertColumn: (values: typeof columns.$inferInsert): ColumnRow =>
      db.insert(columns).values(values).returning().get(),
  }
}
export type BoardsRepository = ReturnType<typeof createBoardsRepository>
