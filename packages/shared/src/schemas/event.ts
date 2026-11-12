import { z } from 'zod'
import { ACTOR_TYPES } from './activity'
import { idSchema } from './common'

/** Az SSE csatorna (`GET /boards/{id}/events`) eseményének neve; az adat egy `BoardEvent` JSON. */
export const BOARD_EVENT_NAME = 'board'

/**
 * Értesítés egy tábla változásáról. Szándékosan vékony: a kliens az érintett erőforrást
 * újraolvassa (a szerver állapota az igazság), az esemény csak a „mi változott” jelzés.
 */
export const boardEventSchema = z.object({
  /** A naplóbejegyzés azonosítója (az SSE `id` mezője is ez). */
  id: idSchema,
  boardId: idSchema,
  /** `entity.verb`, pl. `card.moved` (lásd az activity log). */
  action: z.string(),
  entityType: z.string(),
  entityId: idSchema,
  /** A kártya azonosítója, ha az esemény kártyához (vagy checklistjéhez, kommentjéhez) kötődik. */
  cardId: idSchema.nullable(),
  actorType: z.enum(ACTOR_TYPES),
  actorId: idSchema,
  createdAt: z.string(),
})
export type BoardEvent = z.infer<typeof boardEventSchema>
