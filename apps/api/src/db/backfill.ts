import { and, asc, eq, isNull } from 'drizzle-orm'
import type { Db } from './client.js'
import { boards, users, workspaceMembers } from './schema.js'
import { createWorkspace } from './workspaceFactory.js'

/**
 * Az M3 előtti adatok pótlása (idempotens): minden felhasználó kap egy saját munkaterületet,
 * és a munkaterület nélküli táblák a létrehozójuk saját munkaterületére kerülnek.
 */
export function backfillWorkspaces(db: Db): void {
  db.transaction(() => {
    for (const user of db.select().from(users).all()) {
      const hasWorkspace = db
        .select()
        .from(workspaceMembers)
        .where(eq(workspaceMembers.userId, user.id))
        .get()
      if (!hasWorkspace) createWorkspace(db, { name: user.name, ownerId: user.id })
    }

    for (const board of db.select().from(boards).where(isNull(boards.workspaceId)).all()) {
      const membership = db
        .select()
        .from(workspaceMembers)
        .where(
          and(eq(workspaceMembers.userId, board.createdBy), eq(workspaceMembers.role, 'owner')),
        )
        .orderBy(asc(workspaceMembers.joinedAt))
        .get()
      if (membership) {
        db.update(boards)
          .set({ workspaceId: membership.workspaceId })
          .where(eq(boards.id, board.id))
          .run()
      }
    }
  })
}
