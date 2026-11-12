import type { AdminInvitationsQuery, AdminUsersQuery } from '@taskflow/shared'
import {
  and,
  desc,
  eq,
  getTableColumns,
  gt,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  sql,
} from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { invitations, sessions, users, workspaceMembers, workspaces } from '../../db/schema.js'

export type AdminUserRow = typeof users.$inferSelect
export type AdminInvitationRow = typeof invitations.$inferSelect & {
  workspaceName: string | null
  invitedByName: string | null
}

/** A `LIKE` jokerkarakterei (`%`, `_`) és a védőkarakter nem lehetnek a keresőkifejezés részei. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`)

/** Csak bejelentkezni képes fiókok: a jelszó nélküli seed felhasználó nem jelenik meg. */
const loginUser = isNotNull(users.passwordHash)

export function createAdminRepository(db: Db) {
  return {
    /** Bármely felhasználó (a jelszó nélküli seed is), pl. a meghívó feladójához. */
    findAnyUser: (id: string): AdminUserRow | undefined =>
      db.select().from(users).where(eq(users.id, id)).get(),
    findUser: (id: string): AdminUserRow | undefined =>
      db
        .select()
        .from(users)
        .where(and(eq(users.id, id), loginUser))
        .get(),
    /** Legújabb elöl; `beforeId`: a kurzor (az ID-k időrendben növekvők). */
    listUsers: (
      filters: Pick<AdminUsersQuery, 'q' | 'status'>,
      limit: number,
      beforeId?: string,
    ): AdminUserRow[] => {
      const pattern = filters.q ? `%${escapeLike(filters.q.toLowerCase())}%` : undefined
      return db
        .select()
        .from(users)
        .where(
          and(
            loginUser,
            pattern
              ? or(
                  sql`lower(${users.name}) like ${pattern} escape '\\'`,
                  sql`lower(${users.email}) like ${pattern} escape '\\'`,
                )
              : undefined,
            filters.status === 'active' ? isNull(users.suspendedAt) : undefined,
            filters.status === 'suspended' ? isNotNull(users.suspendedAt) : undefined,
            filters.status === 'unverified' ? isNull(users.emailVerifiedAt) : undefined,
            beforeId ? lt(users.id, beforeId) : undefined,
          ),
        )
        .orderBy(desc(users.id))
        .limit(limit)
        .all()
    },
    updateUser: (
      id: string,
      values: Partial<typeof users.$inferInsert>,
    ): AdminUserRow | undefined =>
      db.update(users).set(values).where(eq(users.id, id)).returning().get(),
    /** Az aktív (nem felfüggesztett) platform-adminok száma. */
    countActiveAdmins: (): number =>
      db
        .select({ n: sql<number>`count(*)` })
        .from(users)
        .where(and(loginUser, eq(users.isAdmin, true), isNull(users.suspendedAt)))
        .get()?.n ?? 0,
    countUsers: (): { total: number; admins: number; suspended: number; unverified: number } =>
      db
        .select({
          total: sql<number>`count(*)`,
          admins: sql<number>`coalesce(sum(${users.isAdmin}), 0)`,
          suspended: sql<number>`coalesce(sum(${users.suspendedAt} is not null), 0)`,
          unverified: sql<number>`coalesce(sum(${users.emailVerifiedAt} is null), 0)`,
        })
        .from(users)
        .where(loginUser)
        .get()!,
    countSessions: (userId: string, now: Date): number =>
      db
        .select({ n: sql<number>`count(*)` })
        .from(sessions)
        .where(and(eq(sessions.userId, userId), gt(sessions.expiresAt, now)))
        .get()?.n ?? 0,
    /** Törli a felhasználó munkameneteit; a törölt sorok számával tér vissza. */
    deleteUserSessions: (userId: string): number =>
      db.delete(sessions).where(eq(sessions.userId, userId)).run().changes,
    listWorkspaces: (userId: string) =>
      db
        .select({ id: workspaces.id, name: workspaces.name, role: workspaceMembers.role })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
        .where(eq(workspaceMembers.userId, userId))
        .orderBy(workspaces.name)
        .all(),
    listInvitations: (
      status: AdminInvitationsQuery['status'],
      now: Date,
      limit: number,
      beforeId?: string,
    ): AdminInvitationRow[] =>
      db
        .select({
          ...getTableColumns(invitations),
          workspaceName: workspaces.name,
          invitedByName: users.name,
        })
        .from(invitations)
        .leftJoin(workspaces, eq(workspaces.id, invitations.workspaceId))
        .leftJoin(users, eq(users.id, invitations.invitedBy))
        .where(
          and(
            status === 'accepted' ? isNotNull(invitations.acceptedAt) : undefined,
            status === 'revoked'
              ? and(isNotNull(invitations.revokedAt), isNull(invitations.acceptedAt))
              : undefined,
            status === 'pending'
              ? and(
                  isNull(invitations.acceptedAt),
                  isNull(invitations.revokedAt),
                  gt(invitations.expiresAt, now),
                )
              : undefined,
            status === 'expired'
              ? and(
                  isNull(invitations.acceptedAt),
                  isNull(invitations.revokedAt),
                  lte(invitations.expiresAt, now),
                )
              : undefined,
            beforeId ? lt(invitations.id, beforeId) : undefined,
          ),
        )
        .orderBy(desc(invitations.id))
        .limit(limit)
        .all(),
    findInvitation: (id: string): AdminInvitationRow | undefined =>
      db
        .select({
          ...getTableColumns(invitations),
          workspaceName: workspaces.name,
          invitedByName: users.name,
        })
        .from(invitations)
        .leftJoin(workspaces, eq(workspaces.id, invitations.workspaceId))
        .leftJoin(users, eq(users.id, invitations.invitedBy))
        .where(eq(invitations.id, id))
        .get(),
    countPendingInvitations: (now: Date): number =>
      db
        .select({ n: sql<number>`count(*)` })
        .from(invitations)
        .where(
          and(
            isNull(invitations.acceptedAt),
            isNull(invitations.revokedAt),
            gt(invitations.expiresAt, now),
          ),
        )
        .get()?.n ?? 0,
    /** Egy meghívó lejáratása; `revoked`: kézi visszavonás (különben csak lejárt, pl. újraküldéskor). */
    expireInvitation: (id: string, now: Date, revoked: boolean): void => {
      db.update(invitations)
        .set({ expiresAt: now, ...(revoked ? { revokedAt: now } : {}) })
        .where(eq(invitations.id, id))
        .run()
    },
    insertInvitation: (values: typeof invitations.$inferInsert): void => {
      db.insert(invitations).values(values).run()
    },
    findWorkspace: (id: string) => db.select().from(workspaces).where(eq(workspaces.id, id)).get(),
    /** Már tagja-e a munkaterületnek a megadott e-mail-című felhasználó. */
    isMemberByEmail: (workspaceId: string, email: string): boolean =>
      db
        .select({ id: users.id })
        .from(workspaceMembers)
        .innerJoin(users, eq(users.id, workspaceMembers.userId))
        .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(users.email, email)))
        .get() !== undefined,
    /** Az adatbázis elérhetőségének ellenőrzése (egyszerű lekérdezés). */
    ping: (): boolean => {
      try {
        return db.get<{ ok: number }>(sql`select 1 as ok`)?.ok === 1
      } catch {
        return false
      }
    },
    transaction: <T>(fn: () => T): T => db.transaction(fn),
  }
}
export type AdminRepository = ReturnType<typeof createAdminRepository>
