import type { AuditEventDto, AuditQuery } from '@taskflow/shared'
import { newId } from '../../db/ids.js'
import type { AuditRepository, AuditRow } from './audit.repository.js'

export type AuditEntry = {
  /** A végrehajtó; `null`: ismeretlen. */
  actorId: string | null
  /** `domain.verb`, lásd `AUDIT_ACTIONS`. */
  action: string
  targetType: string
  targetId?: string | null
  targetUserId?: string | null
  ip?: string | null
  /** Csak nem érzékeny adat: jelszó, token és kulcs nem kerülhet ide. */
  meta?: Record<string, unknown>
}

const parseMeta = (raw: string): Record<string, unknown> => {
  try {
    const value: unknown = JSON.parse(raw)
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export const toAuditEventDto = (row: AuditRow): AuditEventDto => ({
  id: row.id,
  actorId: row.actorId,
  actorName: row.actorName,
  action: row.action,
  targetType: row.targetType,
  targetId: row.targetId,
  targetUserId: row.targetUserId,
  targetUserName: row.targetUserName,
  ip: row.ip,
  meta: parseMeta(row.meta),
  createdAt: row.createdAt.toISOString(),
})

/** A platformszintű auditnapló (`audit_log`): adminműveletek és fontos hitelesítési események. */
export function createAuditService(repo: AuditRepository) {
  return {
    record(entry: AuditEntry): void {
      repo.insert({
        id: newId(),
        actorId: entry.actorId,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        targetUserId: entry.targetUserId ?? null,
        ip: entry.ip ?? null,
        meta: JSON.stringify(entry.meta ?? {}),
      })
    },
    list(query: AuditQuery) {
      const { limit, cursor, from, to, ...filters } = query
      // Egyel többet kérünk le, hogy kiderüljön, van-e következő oldal.
      const rows = repo.list(
        {
          ...filters,
          from: from ? new Date(from) : undefined,
          to: to ? new Date(to) : undefined,
        },
        limit + 1,
        cursor,
      )
      const page = rows.slice(0, limit)
      return {
        data: page.map(toAuditEventDto),
        nextCursor: rows.length > limit ? page[page.length - 1]!.id : null,
      }
    },
    recent(limit: number): AuditEventDto[] {
      return repo.list({}, limit).map(toAuditEventDto)
    },
  }
}
export type AuditService = ReturnType<typeof createAuditService>
