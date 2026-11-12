import type { ActivityDto } from '@taskflow/shared'
import type { Actor } from '../../auth/actor.js'
import { newId } from '../../db/ids.js'
import type { ActivityRepository, ActivityRow } from './activity.repository.js'

export type ActivityEvent = {
  boardId?: string | null
  workspaceId?: string | null
  /** `entity.verb`, pl. `card.moved`. */
  action: string
  entityType: string
  entityId: string
  /** Nyelvfüggetlen részletek (pl. a régi/új oszlop azonosítója); titkot nem tartalmazhat. */
  meta?: Record<string, unknown>
}

const parseMeta = (json: string): Record<string, unknown> => {
  try {
    const v = JSON.parse(json) as unknown
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

export const toActivityDto = (r: ActivityRow): ActivityDto => ({
  id: r.id,
  boardId: r.boardId,
  actorType: r.actorType,
  actorId: r.actorId,
  actorName: r.actorName,
  apiKeyId: r.apiKeyId,
  action: r.action,
  entityType: r.entityType,
  entityId: r.entityId,
  meta: parseMeta(r.meta),
  createdAt: r.createdAt.toISOString(),
})

const paginate = (rows: ActivityRow[], limit: number) => {
  const page = rows.slice(0, limit)
  return {
    data: page.map(toActivityDto),
    nextCursor: rows.length > limit ? page[page.length - 1]!.id : null,
  }
}

/** Az írási műveletek naplója (`activity_log`): ki (ember vagy API kulcs) mit csinált. */
export function createActivityService(repo: ActivityRepository) {
  return {
    record(actor: Actor, event: ActivityEvent): void {
      repo.insert({
        id: newId(),
        boardId: event.boardId ?? null,
        workspaceId: event.workspaceId ?? null,
        actorType: actor.type,
        actorId: actor.id,
        apiKeyId: actor.type === 'api_key' ? actor.keyId : null,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        meta: JSON.stringify(event.meta ?? {}),
      })
    },
    listForBoard(boardId: string, limit: number, cursor?: string) {
      // Egyel többet kérünk le, hogy kiderüljön, van-e következő oldal.
      return paginate(repo.listForBoard(boardId, limit + 1, cursor), limit)
    },
    listForCard(boardId: string, cardId: string, limit: number, cursor?: string) {
      return paginate(repo.listForCard(boardId, cardId, limit + 1, cursor), limit)
    },
  }
}
export type ActivityService = ReturnType<typeof createActivityService>
