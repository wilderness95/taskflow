import { z } from 'zod'
import { idSchema } from './common'

export const ACTOR_TYPES = ['user', 'api_key'] as const
export type ActorType = (typeof ACTOR_TYPES)[number]

export const activitySchema = z.object({
  id: idSchema,
  boardId: idSchema.nullable(),
  /** `api_key`: az AI agent / kulcs által végzett művelet. */
  actorType: z.enum(ACTOR_TYPES),
  actorId: idSchema,
  actorName: z.string().nullable(),
  /** Az API kulcs azonosítója, ha kulccsal történt. */
  apiKeyId: idSchema.nullable(),
  /** `entity.verb`, pl. `card.moved`; nyelvfüggetlen, a fordítás a frontenden. */
  action: z.string(),
  entityType: z.string(),
  entityId: idSchema,
  meta: z.record(z.string(), z.unknown()),
  createdAt: z.string(),
})
export type ActivityDto = z.infer<typeof activitySchema>

/** Cursor-lapozás: az `limit` elem és a következő oldal kurzora (`null`: nincs több). */
export const pageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().max(200).optional(),
})

export const activityListSchema = z.object({
  data: z.array(activitySchema),
  nextCursor: z.string().nullable(),
})
