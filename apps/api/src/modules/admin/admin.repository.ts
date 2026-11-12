import type { AdminUsersQuery } from '@taskflow/shared'
import { and, desc, eq, gt, isNotNull, isNull, lt, or, sql } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { sessions, users, workspaceMembers, workspaces } from '../../db/schema.js'

export type AdminUserRow = typeof users.$inferSelect

/** A `LIKE` jokerkarakterei (`%`, `_`) és a védőkarakter nem lehetnek a keresőkifejezés részei. */
const escapeLike = (value: string) => value.replace(/[\\%_]/g, (c) => `\\${c}`)

/** Csak bejelentkezni képes fiókok: a jelszó nélküli seed felhasználó nem jelenik meg. */
const loginUser = isNotNull(users.passwordHash)

export function createAdminRepository(db: Db) {
  return {
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
    transaction: <T>(fn: () => T): T => db.transaction(fn),
  }
}
export type AdminRepository = ReturnType<typeof createAdminRepository>
