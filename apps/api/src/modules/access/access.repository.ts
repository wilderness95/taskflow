import type { BoardRole, WorkspaceRole } from '@taskflow/shared'
import { and, eq, isNull } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import {
  boardMembers,
  boards,
  cards,
  checklistItems,
  checklists,
  columns,
  workspaceMembers,
} from '../../db/schema.js'

export type BoardRow = typeof boards.$inferSelect

/** A jogosultság-ellenőrzéshez szükséges adatok (tagságok, erőforrás → tábla feloldás). */
export function createAccessRepository(db: Db) {
  return {
    findActiveBoard: (boardId: string): BoardRow | undefined =>
      db
        .select()
        .from(boards)
        .where(and(eq(boards.id, boardId), isNull(boards.archivedAt)))
        .get(),
    workspaceRole: (workspaceId: string, userId: string): WorkspaceRole | null =>
      db
        .select({ role: workspaceMembers.role })
        .from(workspaceMembers)
        .where(
          and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)),
        )
        .get()?.role ?? null,
    boardRole: (boardId: string, userId: string): BoardRole | null =>
      db
        .select({ role: boardMembers.role })
        .from(boardMembers)
        .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)))
        .get()?.role ?? null,
    boardIdOfColumn: (columnId: string): string | undefined =>
      db.select({ id: columns.boardId }).from(columns).where(eq(columns.id, columnId)).get()?.id,
    boardIdOfCard: (cardId: string): string | undefined =>
      db
        .select({ id: columns.boardId })
        .from(cards)
        .innerJoin(columns, eq(columns.id, cards.columnId))
        .where(and(eq(cards.id, cardId), isNull(cards.archivedAt)))
        .get()?.id,
    boardIdOfChecklist: (checklistId: string): string | undefined =>
      db
        .select({ id: columns.boardId })
        .from(checklists)
        .innerJoin(cards, eq(cards.id, checklists.cardId))
        .innerJoin(columns, eq(columns.id, cards.columnId))
        .where(eq(checklists.id, checklistId))
        .get()?.id,
    boardIdOfChecklistItem: (itemId: string): string | undefined =>
      db
        .select({ id: columns.boardId })
        .from(checklistItems)
        .innerJoin(checklists, eq(checklists.id, checklistItems.checklistId))
        .innerJoin(cards, eq(cards.id, checklists.cardId))
        .innerJoin(columns, eq(columns.id, cards.columnId))
        .where(eq(checklistItems.id, itemId))
        .get()?.id,
  }
}
export type AccessRepository = ReturnType<typeof createAccessRepository>
