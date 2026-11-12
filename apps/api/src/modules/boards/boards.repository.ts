import type { BoardRole, WorkspaceRole } from '@taskflow/shared'
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import {
  boardMembers,
  boardStars,
  boards,
  columns,
  labels,
  users,
  workspaceMembers,
} from '../../db/schema.js'

export type BoardRow = typeof boards.$inferSelect
export type ColumnRow = typeof columns.$inferSelect
export type LabelRow = typeof labels.$inferSelect
export type BoardListRow = {
  board: BoardRow
  workspaceRole: WorkspaceRole
  boardRole: BoardRole | null
  starred: boolean
}

export function createBoardsRepository(db: Db) {
  return {
    /** A felhasználó munkaterületeinek táblái a hozzá tartozó szerepkörökkel (a láthatóságot a policy dönti el). */
    listForUser: (userId: string, workspaceId?: string): BoardListRow[] => {
      const rows = db
        .select({ board: boards, workspaceRole: workspaceMembers.role })
        .from(boards)
        .innerJoin(
          workspaceMembers,
          and(
            eq(workspaceMembers.workspaceId, boards.workspaceId),
            eq(workspaceMembers.userId, userId),
          ),
        )
        .where(
          and(
            isNull(boards.archivedAt),
            workspaceId ? eq(boards.workspaceId, workspaceId) : undefined,
          ),
        )
        .orderBy(asc(boards.createdAt), asc(boards.id))
        .all()
      const ids = rows.map((r) => r.board.id)
      if (ids.length === 0) return []
      const roles = new Map(
        db
          .select()
          .from(boardMembers)
          .where(and(eq(boardMembers.userId, userId), inArray(boardMembers.boardId, ids)))
          .all()
          .map((m) => [m.boardId, m.role]),
      )
      const starred = new Set(
        db
          .select()
          .from(boardStars)
          .where(and(eq(boardStars.userId, userId), inArray(boardStars.boardId, ids)))
          .all()
          .map((s) => s.boardId),
      )
      return rows.map((r) => ({
        board: r.board,
        workspaceRole: r.workspaceRole,
        boardRole: roles.get(r.board.id) ?? null,
        starred: starred.has(r.board.id),
      }))
    },
    isStarred: (boardId: string, userId: string): boolean =>
      Boolean(
        db
          .select()
          .from(boardStars)
          .where(and(eq(boardStars.boardId, boardId), eq(boardStars.userId, userId)))
          .get(),
      ),
    star: (boardId: string, userId: string): void => {
      db.insert(boardStars).values({ boardId, userId }).onConflictDoNothing().run()
    },
    unstar: (boardId: string, userId: string): void => {
      db.delete(boardStars)
        .where(and(eq(boardStars.boardId, boardId), eq(boardStars.userId, userId)))
        .run()
    },
    listBoardMembers: (boardId: string) =>
      db
        .select({
          userId: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
          role: boardMembers.role,
        })
        .from(boardMembers)
        .innerJoin(users, eq(users.id, boardMembers.userId))
        .where(eq(boardMembers.boardId, boardId))
        .orderBy(asc(users.name))
        .all(),
    getBoardRole: (boardId: string, userId: string): BoardRole | null =>
      db
        .select({ role: boardMembers.role })
        .from(boardMembers)
        .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)))
        .get()?.role ?? null,
    setBoardMember: (boardId: string, userId: string, role: BoardRole): void => {
      db.insert(boardMembers)
        .values({ boardId, userId, role })
        .onConflictDoUpdate({ target: [boardMembers.boardId, boardMembers.userId], set: { role } })
        .run()
    },
    removeBoardMember: (boardId: string, userId: string): void => {
      db.delete(boardMembers)
        .where(and(eq(boardMembers.boardId, boardId), eq(boardMembers.userId, userId)))
        .run()
    },
    workspaceRole: (workspaceId: string, userId: string): WorkspaceRole | null =>
      db
        .select({ role: workspaceMembers.role })
        .from(workspaceMembers)
        .where(
          and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)),
        )
        .get()?.role ?? null,
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
    transaction: <T>(fn: () => T): T => db.transaction(fn),
    insertColumn: (values: typeof columns.$inferInsert): ColumnRow =>
      db.insert(columns).values(values).returning().get(),
  }
}
export type BoardsRepository = ReturnType<typeof createBoardsRepository>
