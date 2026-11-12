import { and, asc, count, eq, isNotNull, isNull, sql } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { listItems, lists, listSections } from '../../db/schema.js'

export type ListRow = typeof lists.$inferSelect
export type ListSectionRow = typeof listSections.$inferSelect
export type ListItemRow = typeof listItems.$inferSelect

export function createListsRepository(db: Db) {
  const itemsWhere = (listId: string, sectionId: string | null) =>
    and(
      eq(listItems.listId, listId),
      sectionId === null ? isNull(listItems.sectionId) : eq(listItems.sectionId, sectionId),
    )

  return {
    transaction: <T>(fn: () => T): T => db.transaction(fn),

    // --- listák ---
    findList: (id: string): ListRow | undefined =>
      db.select().from(lists).where(eq(lists.id, id)).get(),
    listsOfWorkspace: (workspaceId: string, archived: boolean): ListRow[] =>
      db
        .select()
        .from(lists)
        .where(
          and(
            eq(lists.workspaceId, workspaceId),
            archived ? isNotNull(lists.archivedAt) : isNull(lists.archivedAt),
          ),
        )
        .orderBy(asc(lists.createdAt), asc(lists.id))
        .all(),
    countActiveLists: (workspaceId: string): number =>
      db
        .select({ n: count() })
        .from(lists)
        .where(and(eq(lists.workspaceId, workspaceId), isNull(lists.archivedAt)))
        .get()?.n ?? 0,
    /** Listánként a tételek és a kipipáltak száma. */
    itemCounts: (workspaceId: string): Map<string, { total: number; done: number }> => {
      const rows = db
        .select({
          listId: listItems.listId,
          total: count(),
          done: sql<number>`coalesce(sum(${listItems.done}), 0)`,
        })
        .from(listItems)
        .innerJoin(lists, eq(lists.id, listItems.listId))
        .where(eq(lists.workspaceId, workspaceId))
        .groupBy(listItems.listId)
        .all()
      return new Map(rows.map((r) => [r.listId, { total: r.total, done: Number(r.done) }]))
    },
    insertList: (values: typeof lists.$inferInsert): ListRow =>
      db.insert(lists).values(values).returning().get(),
    updateList: (id: string, values: Partial<typeof lists.$inferInsert>): ListRow | undefined =>
      db.update(lists).set(values).where(eq(lists.id, id)).returning().get(),

    // --- szakaszok ---
    sectionsOf: (listId: string): ListSectionRow[] =>
      db
        .select()
        .from(listSections)
        .where(eq(listSections.listId, listId))
        .orderBy(asc(listSections.position), asc(listSections.id))
        .all(),
    findSection: (id: string): ListSectionRow | undefined =>
      db.select().from(listSections).where(eq(listSections.id, id)).get(),
    insertSection: (values: typeof listSections.$inferInsert): ListSectionRow =>
      db.insert(listSections).values(values).returning().get(),
    updateSection: (
      id: string,
      values: Partial<typeof listSections.$inferInsert>,
    ): ListSectionRow | undefined =>
      db.update(listSections).set(values).where(eq(listSections.id, id)).returning().get(),
    deleteSection: (id: string): void => {
      db.delete(listSections).where(eq(listSections.id, id)).run()
    },

    // --- tételek ---
    itemsOf: (listId: string): ListItemRow[] =>
      db
        .select()
        .from(listItems)
        .where(eq(listItems.listId, listId))
        .orderBy(asc(listItems.position), asc(listItems.id))
        .all(),
    findItem: (id: string): ListItemRow | undefined =>
      db.select().from(listItems).where(eq(listItems.id, id)).get(),
    countItems: (listId: string): number =>
      db.select({ n: count() }).from(listItems).where(eq(listItems.listId, listId)).get()?.n ?? 0,
    /** Egy csoport (szakasz vagy a szakasz nélküliek) tételei sorrendben. */
    itemsInGroup: (listId: string, sectionId: string | null): ListItemRow[] =>
      db
        .select()
        .from(listItems)
        .where(itemsWhere(listId, sectionId))
        .orderBy(asc(listItems.position), asc(listItems.id))
        .all(),
    insertItem: (values: typeof listItems.$inferInsert): ListItemRow =>
      db.insert(listItems).values(values).returning().get(),
    updateItem: (
      id: string,
      values: Partial<typeof listItems.$inferInsert>,
    ): ListItemRow | undefined =>
      db
        .update(listItems)
        .set({ ...values, version: sql`${listItems.version} + 1` })
        .where(eq(listItems.id, id))
        .returning()
        .get(),
    deleteItem: (id: string): void => {
      db.delete(listItems).where(eq(listItems.id, id)).run()
    },
    /** A kipipált, nem ismétlődő tételek törlése; a törölt tételek száma. */
    deleteDoneNonRecurring: (listId: string): number =>
      db
        .delete(listItems)
        .where(
          and(
            eq(listItems.listId, listId),
            eq(listItems.done, true),
            eq(listItems.recurring, false),
          ),
        )
        .run().changes,
    /** A kipipált ismétlődő tételek újranyitása; az érintett tételek száma. */
    reopenDoneRecurring: (listId: string): number =>
      db
        .update(listItems)
        .set({ done: false, version: sql`${listItems.version} + 1` })
        .where(
          and(
            eq(listItems.listId, listId),
            eq(listItems.done, true),
            eq(listItems.recurring, true),
          ),
        )
        .run().changes,
  }
}
export type ListsRepository = ReturnType<typeof createListsRepository>
