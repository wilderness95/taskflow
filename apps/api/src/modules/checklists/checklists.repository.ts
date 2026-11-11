import { asc, desc, eq, inArray } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { checklistItems, checklists } from '../../db/schema.js'

export type ChecklistRow = typeof checklists.$inferSelect
export type ChecklistItemRow = typeof checklistItems.$inferSelect

export function createChecklistsRepository(db: Db) {
  return {
    listByCardIds: (cardIds: string[]): (ChecklistRow & { items: ChecklistItemRow[] })[] => {
      if (cardIds.length === 0) return []
      const lists = db
        .select()
        .from(checklists)
        .where(inArray(checklists.cardId, cardIds))
        .orderBy(asc(checklists.position))
        .all()
      const items = db
        .select()
        .from(checklistItems)
        .where(
          inArray(
            checklistItems.checklistId,
            lists.map((l) => l.id),
          ),
        )
        .orderBy(asc(checklistItems.position))
        .all()
      return lists.map((l) => ({ ...l, items: items.filter((i) => i.checklistId === l.id) }))
    },
    findById: (id: string): ChecklistRow | undefined =>
      db.select().from(checklists).where(eq(checklists.id, id)).get(),
    insert: (values: typeof checklists.$inferInsert): ChecklistRow =>
      db.insert(checklists).values(values).returning().get(),
    update: (id: string, values: Partial<typeof checklists.$inferInsert>) =>
      db.update(checklists).set(values).where(eq(checklists.id, id)).returning().get(),
    delete: (id: string): void => {
      db.delete(checklists).where(eq(checklists.id, id)).run()
    },
    lastChecklistPosition: (cardId: string): string | null =>
      db
        .select({ position: checklists.position })
        .from(checklists)
        .where(eq(checklists.cardId, cardId))
        .orderBy(desc(checklists.position))
        .limit(1)
        .get()?.position ?? null,
    findItem: (id: string): ChecklistItemRow | undefined =>
      db.select().from(checklistItems).where(eq(checklistItems.id, id)).get(),
    insertItem: (values: typeof checklistItems.$inferInsert): ChecklistItemRow =>
      db.insert(checklistItems).values(values).returning().get(),
    updateItem: (id: string, values: Partial<typeof checklistItems.$inferInsert>) =>
      db.update(checklistItems).set(values).where(eq(checklistItems.id, id)).returning().get(),
    deleteItem: (id: string): void => {
      db.delete(checklistItems).where(eq(checklistItems.id, id)).run()
    },
    lastItemPosition: (checklistId: string): string | null =>
      db
        .select({ position: checklistItems.position })
        .from(checklistItems)
        .where(eq(checklistItems.checklistId, checklistId))
        .orderBy(desc(checklistItems.position))
        .limit(1)
        .get()?.position ?? null,
  }
}
export type ChecklistsRepository = ReturnType<typeof createChecklistsRepository>
