import type { AuditQuery } from '@taskflow/shared'
import { and, desc, eq, gte, lt, lte } from 'drizzle-orm'
import { alias } from 'drizzle-orm/sqlite-core'
import type { Db } from '../../db/client.js'
import { auditLog, users } from '../../db/schema.js'

export type AuditRow = typeof auditLog.$inferSelect & {
  actorName: string | null
  targetUserName: string | null
}

export type AuditFilters = Pick<AuditQuery, 'action' | 'actorId' | 'targetUserId'> & {
  from?: Date
  to?: Date
}

export function createAuditRepository(db: Db) {
  const actor = alias(users, 'audit_actor')
  const target = alias(users, 'audit_target')

  return {
    insert: (values: typeof auditLog.$inferInsert): void => {
      db.insert(auditLog).values(values).run()
    },
    /** A megadott időpontnál régebbi bejegyzések törlése; a törölt sorok számával tér vissza. */
    deleteOlderThan: (cutoff: Date): number =>
      db.delete(auditLog).where(lt(auditLog.createdAt, cutoff)).run().changes,
    /** Legújabb elöl; `beforeId`: a kurzor (az ID-k időrendben növekvők). */
    list: (filters: AuditFilters, limit: number, beforeId?: string): AuditRow[] =>
      db
        .select({
          id: auditLog.id,
          actorId: auditLog.actorId,
          action: auditLog.action,
          targetType: auditLog.targetType,
          targetId: auditLog.targetId,
          targetUserId: auditLog.targetUserId,
          ip: auditLog.ip,
          meta: auditLog.meta,
          createdAt: auditLog.createdAt,
          actorName: actor.name,
          targetUserName: target.name,
        })
        .from(auditLog)
        .leftJoin(actor, eq(actor.id, auditLog.actorId))
        .leftJoin(target, eq(target.id, auditLog.targetUserId))
        .where(
          and(
            filters.action ? eq(auditLog.action, filters.action) : undefined,
            filters.actorId ? eq(auditLog.actorId, filters.actorId) : undefined,
            filters.targetUserId ? eq(auditLog.targetUserId, filters.targetUserId) : undefined,
            filters.from ? gte(auditLog.createdAt, filters.from) : undefined,
            filters.to ? lte(auditLog.createdAt, filters.to) : undefined,
            beforeId ? lt(auditLog.id, beforeId) : undefined,
          ),
        )
        .orderBy(desc(auditLog.id))
        .limit(limit)
        .all(),
  }
}
export type AuditRepository = ReturnType<typeof createAuditRepository>
