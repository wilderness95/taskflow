import type { InvitableRole } from '@taskflow/shared'
import { and, eq, isNull, lt, sql } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { emailTokens, invitations, sessions, users, workspaceMembers } from '../../db/schema.js'
import { createWorkspace } from '../../db/workspaceFactory.js'

export type UserRow = typeof users.$inferSelect
export type SessionRow = typeof sessions.$inferSelect
export type EmailTokenRow = typeof emailTokens.$inferSelect
export type InvitationRow = typeof invitations.$inferSelect

export function createAuthRepository(db: Db) {
  return {
    findUserById: (id: string): UserRow | undefined =>
      db.select().from(users).where(eq(users.id, id)).get(),
    findUserByEmail: (email: string): UserRow | undefined =>
      db.select().from(users).where(eq(users.email, email)).get(),
    /** Hány felhasználó tud bejelentkezni (a jelszó nélküli seed felhasználó nem számít). */
    countLoginUsers: (): number =>
      db
        .select({ n: sql<number>`count(*)` })
        .from(users)
        .where(sql`${users.passwordHash} is not null`)
        .get()?.n ?? 0,
    insertUser: (values: typeof users.$inferInsert): UserRow =>
      db.insert(users).values(values).returning().get(),
    updateUser: (id: string, values: Partial<typeof users.$inferInsert>): UserRow | undefined =>
      db.update(users).set(values).where(eq(users.id, id)).returning().get(),

    insertSession: (values: typeof sessions.$inferInsert): SessionRow =>
      db.insert(sessions).values(values).returning().get(),
    findSession: (id: string): SessionRow | undefined =>
      db.select().from(sessions).where(eq(sessions.id, id)).get(),
    deleteSession: (id: string): void => {
      db.delete(sessions).where(eq(sessions.id, id)).run()
    },
    deleteUserSessions: (userId: string): void => {
      db.delete(sessions).where(eq(sessions.userId, userId)).run()
    },
    deleteExpiredSessions: (now: Date): void => {
      db.delete(sessions).where(lt(sessions.expiresAt, now)).run()
    },

    insertEmailToken: (values: typeof emailTokens.$inferInsert): void => {
      db.insert(emailTokens).values(values).run()
    },
    findEmailToken: (tokenHash: string, type: EmailTokenRow['type']): EmailTokenRow | undefined =>
      db
        .select()
        .from(emailTokens)
        .where(and(eq(emailTokens.tokenHash, tokenHash), eq(emailTokens.type, type)))
        .get(),
    markEmailTokenUsed: (id: string, now: Date): void => {
      db.update(emailTokens).set({ usedAt: now }).where(eq(emailTokens.id, id)).run()
    },
    /** Egy felhasználó korábbi, még fel nem használt tokenjeinek érvénytelenítése. */
    invalidateEmailTokens: (userId: string, type: EmailTokenRow['type'], now: Date): void => {
      db.update(emailTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(emailTokens.userId, userId),
            eq(emailTokens.type, type),
            isNull(emailTokens.usedAt),
          ),
        )
        .run()
    },

    insertInvitation: (values: typeof invitations.$inferInsert): InvitationRow =>
      db.insert(invitations).values(values).returning().get(),
    findInvitation: (tokenHash: string): InvitationRow | undefined =>
      db.select().from(invitations).where(eq(invitations.tokenHash, tokenHash)).get(),
    markInvitationAccepted: (id: string, now: Date): void => {
      db.update(invitations).set({ acceptedAt: now }).where(eq(invitations.id, id)).run()
    },
    /** Minden felhasználónak van egy saját munkaterülete (a seed felhasználóé már létezik). */
    ensurePersonalWorkspace: (userId: string, name: string): void => {
      const hasWorkspace = db
        .select()
        .from(workspaceMembers)
        .where(eq(workspaceMembers.userId, userId))
        .get()
      if (!hasWorkspace) createWorkspace(db, { name, ownerId: userId })
    },
    addWorkspaceMember: (workspaceId: string, userId: string, role: InvitableRole): void => {
      db.insert(workspaceMembers).values({ workspaceId, userId, role }).onConflictDoNothing().run()
    },
    transaction: <T>(fn: () => T): T => db.transaction(fn),
  }
}
export type AuthRepository = ReturnType<typeof createAuthRepository>
