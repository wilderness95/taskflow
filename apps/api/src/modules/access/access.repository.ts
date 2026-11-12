import type { BoardRole, WorkspaceRole } from '@taskflow/shared'
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import {
  boardMembers,
  boards,
  cards,
  checklistItems,
  checklists,
  columns,
  labels,
  users,
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
    findArchivedBoard: (boardId: string): BoardRow | undefined =>
      db
        .select()
        .from(boards)
        .where(and(eq(boards.id, boardId), isNotNull(boards.archivedAt)))
        .get(),
    boardIdOfArchivedCard: (cardId: string): string | undefined =>
      db
        .select({ id: columns.boardId })
        .from(cards)
        .innerJoin(columns, eq(columns.id, cards.columnId))
        .where(and(eq(cards.id, cardId), isNotNull(cards.archivedAt)))
        .get()?.id,
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
    workspaceMemberRoles: (workspaceId: string): { userId: string; role: WorkspaceRole }[] =>
      db
        .select({ userId: workspaceMembers.userId, role: workspaceMembers.role })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.workspaceId, workspaceId))
        .all(),
    boardMemberRoles: (boardId: string): { userId: string; role: BoardRole }[] =>
      db
        .select({ userId: boardMembers.userId, role: boardMembers.role })
        .from(boardMembers)
        .where(eq(boardMembers.boardId, boardId))
        .all(),
    usersByIds: (ids: string[]) =>
      ids.length === 0
        ? []
        : db
            .select({
              id: users.id,
              name: users.name,
              email: users.email,
              avatarUrl: users.avatarUrl,
            })
            .from(users)
            .where(inArray(users.id, ids))
            .all(),
    boardIdOfColumn: (columnId: string): string | undefined =>
      db.select({ id: columns.boardId }).from(columns).where(eq(columns.id, columnId)).get()?.id,
    boardIdOfCard: (cardId: string): string | undefined =>
      db
        .select({ id: columns.boardId })
        .from(cards)
        .innerJoin(columns, eq(columns.id, cards.columnId))
        .where(and(eq(cards.id, cardId), isNull(cards.archivedAt)))
        .get()?.id,
    boardIdOfLabel: (labelId: string): string | undefined =>
      db.select({ id: labels.boardId }).from(labels).where(eq(labels.id, labelId)).get()?.id,
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
