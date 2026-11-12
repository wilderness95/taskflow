import { and, asc, eq } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { savedFilters } from '../../db/schema.js'

export type SavedFilterRow = typeof savedFilters.$inferSelect

export function createFiltersRepository(db: Db) {
  return {
    findById: (id: string): SavedFilterRow | undefined =>
      db.select().from(savedFilters).where(eq(savedFilters.id, id)).get(),
    findByName: (boardId: string, userId: string, name: string): SavedFilterRow | undefined =>
      db
        .select()
        .from(savedFilters)
        .where(
          and(
            eq(savedFilters.boardId, boardId),
            eq(savedFilters.userId, userId),
            eq(savedFilters.name, name),
          ),
        )
        .get(),
    list: (boardId: string, userId: string): SavedFilterRow[] =>
      db
        .select()
        .from(savedFilters)
        .where(and(eq(savedFilters.boardId, boardId), eq(savedFilters.userId, userId)))
        .orderBy(asc(savedFilters.name))
        .all(),
    insert: (values: typeof savedFilters.$inferInsert): SavedFilterRow =>
      db.insert(savedFilters).values(values).returning().get(),
    delete: (id: string): void => {
      db.delete(savedFilters).where(eq(savedFilters.id, id)).run()
    },
  }
}
export type FiltersRepository = ReturnType<typeof createFiltersRepository>
