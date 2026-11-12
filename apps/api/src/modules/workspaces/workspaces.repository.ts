import type { WorkspaceRole } from '@taskflow/shared'
import { and, asc, count, desc, eq, gt, inArray, isNull } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import {
  boardMembers,
  attachments,
  boardStars,
  boards,
  cards,
  columns,
  invitations,
  users,
  workspaceMembers,
  workspaces,
} from '../../db/schema.js'
import { createWorkspace } from '../../db/workspaceFactory.js'

export type WorkspaceRow = typeof workspaces.$inferSelect
export type InvitationRow = typeof invitations.$inferSelect

export function createWorkspacesRepository(db: Db) {
  return {
    listForUser: (userId: string): (WorkspaceRow & { role: WorkspaceRole })[] =>
      db
        .select({
          id: workspaces.id,
          name: workspaces.name,
          slug: workspaces.slug,
          createdBy: workspaces.createdBy,
          createdAt: workspaces.createdAt,
          role: workspaceMembers.role,
        })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
        .where(eq(workspaceMembers.userId, userId))
        .orderBy(asc(workspaces.createdAt), asc(workspaces.id))
        .all(),
    findById: (id: string): WorkspaceRow | undefined =>
      db.select().from(workspaces).where(eq(workspaces.id, id)).get(),
    getRole: (workspaceId: string, userId: string): WorkspaceRole | null =>
      db
        .select({ role: workspaceMembers.role })
        .from(workspaceMembers)
        .where(
          and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)),
        )
        .get()?.role ?? null,
    create: (name: string, ownerId: string): WorkspaceRow => createWorkspace(db, { name, ownerId }),
    updateName: (id: string, name: string): WorkspaceRow | undefined =>
      db.update(workspaces).set({ name }).where(eq(workspaces.id, id)).returning().get(),
    delete: (id: string): void => {
      db.delete(invitations).where(eq(invitations.workspaceId, id)).run()
      db.delete(workspaces).where(eq(workspaces.id, id)).run()
    },
    /** Az aktív (nem archivált) táblák száma. */
    countBoards: (id: string): number =>
      db
        .select({ n: count() })
        .from(boards)
        .where(and(eq(boards.workspaceId, id), isNull(boards.archivedAt)))
        .get()?.n ?? 0,
    /**
     * A munkaterület (archivált) tábláinak végleges törlése a tartalmukkal együtt (oszlopok,
     * kártyák és ezek gyerekei). A csatolmányok fájlkulcsait adja vissza, hogy a hívó a fájlokat is törölje.
     * Tranzakcióban hívandó, a munkaterület törlése előtt.
     */
    purgeBoards: (workspaceId: string): string[] => {
      const boardIds = db
        .select({ id: boards.id })
        .from(boards)
        .where(eq(boards.workspaceId, workspaceId))
        .all()
        .map((b) => b.id)
      if (boardIds.length === 0) return []
      const columnIds = db
        .select({ id: columns.id })
        .from(columns)
        .where(inArray(columns.boardId, boardIds))
        .all()
        .map((c) => c.id)
      let keys: string[] = []
      if (columnIds.length > 0) {
        const cardIds = db
          .select({ id: cards.id })
          .from(cards)
          .where(inArray(cards.columnId, columnIds))
          .all()
          .map((c) => c.id)
        if (cardIds.length > 0) {
          keys = db
            .select({ key: attachments.storageKey })
            .from(attachments)
            .where(inArray(attachments.cardId, cardIds))
            .all()
            .map((a) => a.key)
          db.delete(cards).where(inArray(cards.id, cardIds)).run()
        }
        db.delete(columns).where(inArray(columns.id, columnIds)).run()
      }
      db.delete(boards).where(inArray(boards.id, boardIds)).run()
      return keys
    },

    listMembers: (workspaceId: string) =>
      db
        .select({
          userId: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
          role: workspaceMembers.role,
          joinedAt: workspaceMembers.joinedAt,
        })
        .from(workspaceMembers)
        .innerJoin(users, eq(users.id, workspaceMembers.userId))
        .where(eq(workspaceMembers.workspaceId, workspaceId))
        .orderBy(asc(workspaceMembers.joinedAt), asc(users.name))
        .all(),
    countOwners: (workspaceId: string): number =>
      db
        .select({ n: count() })
        .from(workspaceMembers)
        .where(
          and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.role, 'owner')),
        )
        .get()?.n ?? 0,
    addMember: (workspaceId: string, userId: string, role: WorkspaceRole): void => {
      db.insert(workspaceMembers).values({ workspaceId, userId, role }).run()
    },
    setRole: (workspaceId: string, userId: string, role: WorkspaceRole): void => {
      db.update(workspaceMembers)
        .set({ role })
        .where(
          and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)),
        )
        .run()
    },
    /** Eltávolítja a tagot, és vele a munkaterület tábláihoz tartozó explicit szerepköreit és csillagait. */
    removeMember: (workspaceId: string, userId: string): void => {
      const boardIds = db
        .select({ id: boards.id })
        .from(boards)
        .where(eq(boards.workspaceId, workspaceId))
        .all()
        .map((b) => b.id)
      if (boardIds.length > 0) {
        db.delete(boardMembers)
          .where(and(eq(boardMembers.userId, userId), inArray(boardMembers.boardId, boardIds)))
          .run()
        db.delete(boardStars)
          .where(and(eq(boardStars.userId, userId), inArray(boardStars.boardId, boardIds)))
          .run()
      }
      db.delete(workspaceMembers)
        .where(
          and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)),
        )
        .run()
    },
    isMemberByEmail: (workspaceId: string, email: string): boolean =>
      Boolean(
        db
          .select({ id: users.id })
          .from(workspaceMembers)
          .innerJoin(users, eq(users.id, workspaceMembers.userId))
          .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(users.email, email)))
          .get(),
      ),

    listPendingInvitations: (workspaceId: string, now: Date): InvitationRow[] =>
      db
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.workspaceId, workspaceId),
            isNull(invitations.acceptedAt),
            gt(invitations.expiresAt, now),
          ),
        )
        .orderBy(desc(invitations.createdAt))
        .all(),
    findInvitation: (id: string): InvitationRow | undefined =>
      db.select().from(invitations).where(eq(invitations.id, id)).get(),
    findInvitationByTokenHash: (tokenHash: string): InvitationRow | undefined =>
      db.select().from(invitations).where(eq(invitations.tokenHash, tokenHash)).get(),
    insertInvitation: (values: typeof invitations.$inferInsert): InvitationRow =>
      db.insert(invitations).values(values).returning().get(),
    /** Ugyanarra az e-mail-címre szóló korábbi, még függő meghívók lejáratása. */
    expirePendingInvitations: (workspaceId: string, email: string, now: Date): void => {
      db.update(invitations)
        .set({ expiresAt: now })
        .where(
          and(
            eq(invitations.workspaceId, workspaceId),
            eq(invitations.email, email),
            isNull(invitations.acceptedAt),
          ),
        )
        .run()
    },
    expireInvitation: (id: string, now: Date): void => {
      db.update(invitations)
        .set({ expiresAt: now, revokedAt: now })
        .where(eq(invitations.id, id))
        .run()
    },
    markInvitationAccepted: (id: string, now: Date): void => {
      db.update(invitations).set({ acceptedAt: now }).where(eq(invitations.id, id)).run()
    },
    findUser: (userId: string) =>
      db
        .select({ id: users.id, name: users.name, email: users.email, locale: users.locale })
        .from(users)
        .where(eq(users.id, userId))
        .get(),
    transaction: <T>(fn: () => T): T => db.transaction(fn),
  }
}
export type WorkspacesRepository = ReturnType<typeof createWorkspacesRepository>
