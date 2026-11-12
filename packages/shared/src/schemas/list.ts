import { z } from 'zod'
import { idSchema, titleSchema } from './common'
import { ACTOR_TYPES } from './activity'

/** Egy munkaterületen ennyi aktív lista lehet. */
export const MAX_LISTS_PER_WORKSPACE = 100
/** Egy listán ennyi szakasz és tétel lehet (az archivált lista is megtartja). */
export const MAX_LIST_SECTIONS = 50
export const MAX_LIST_ITEMS = 500

/** Az SSE csatorna (`GET /lists/{id}/events`) eseményének neve; az adat egy `ListEvent` JSON. */
export const LIST_EVENT_NAME = 'list'

const itemTextSchema = z.string().trim().min(1).max(300)
const versionSchema = z.number().int().min(1).optional()

export const listSectionSchema = z.object({
  id: idSchema,
  listId: idSchema,
  title: z.string(),
  position: z.string(),
})
export type ListSectionDto = z.infer<typeof listSectionSchema>

export const listItemSchema = z.object({
  id: idSchema,
  listId: idSchema,
  /** `null`: szakasz nélküli tétel. */
  sectionId: idSchema.nullable(),
  text: z.string(),
  done: z.boolean(),
  /** Ismétlődő tétel: a „visszaállítás” újra nyitja, a „kipipáltak törlése” nem törli. */
  recurring: z.boolean(),
  position: z.string(),
  version: z.number().int(),
  createdAt: z.string(),
})
export type ListItemDto = z.infer<typeof listItemSchema>

export const listSummarySchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  title: z.string(),
  itemCount: z.number().int(),
  doneCount: z.number().int(),
  archivedAt: z.string().nullable(),
  createdAt: z.string(),
})
export type ListSummaryDto = z.infer<typeof listSummarySchema>
export const listSummaryListSchema = z.object({ data: z.array(listSummarySchema) })

/** Egy lista teljes tartalma (a listák kicsik, ezért egyben jönnek). */
export const listDetailSchema = listSummarySchema.extend({
  /** A szereplő munkaterületi szerepköre (a UI ebből tiltja le az írást). */
  myRole: z.enum(['owner', 'admin', 'member', 'viewer']).nullable(),
  sections: z.array(listSectionSchema),
  items: z.array(listItemSchema),
})
export type ListDetailDto = z.infer<typeof listDetailSchema>

export const listQuerySchema = z.object({
  archived: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
})

export const createListSchema = z.object({ title: titleSchema })
export type CreateListInput = z.infer<typeof createListSchema>
export const updateListSchema = z.object({ title: titleSchema })
export type UpdateListInput = z.infer<typeof updateListSchema>

export const createListSectionSchema = z.object({ title: titleSchema })
export type CreateListSectionInput = z.infer<typeof createListSectionSchema>
export const updateListSectionSchema = z.object({ title: titleSchema })
export type UpdateListSectionInput = z.infer<typeof updateListSectionSchema>
/** Szakasz áthelyezése: a `beforeSectionId` elé kerül, ennek hiányában a végére. */
export const moveListSectionSchema = z.object({ beforeSectionId: idSchema.nullish() })
export type MoveListSectionInput = z.infer<typeof moveListSectionSchema>

export const createListItemSchema = z.object({
  text: itemTextSchema,
  sectionId: idSchema.nullish(),
  recurring: z.boolean().default(false),
})
export type CreateListItemInput = z.infer<typeof createListItemSchema>
export type CreateListItemRequest = z.input<typeof createListItemSchema>

export const updateListItemSchema = z
  .object({
    text: itemTextSchema,
    done: z.boolean(),
    recurring: z.boolean(),
    version: versionSchema,
  })
  .partial()
  .refine((v) => Object.keys(v).some((k) => k !== 'version'), 'Nothing to update')
export type UpdateListItemInput = z.infer<typeof updateListItemSchema>

/** Tétel áthelyezése: a `sectionId` szakasz (vagy `null`: szakasz nélkül) `beforeItemId` elé, vagy a végére. */
export const moveListItemSchema = z.object({
  sectionId: idSchema.nullable(),
  beforeItemId: idSchema.nullish(),
  version: versionSchema,
})
export type MoveListItemInput = z.infer<typeof moveListItemSchema>

/** A tömeges műveletek (`clear-done`, `reset-recurring`) eredménye. */
export const listBulkResultSchema = z.object({ affected: z.number().int() })

/** Vékony esemény: a kliens a listát újraolvassa. */
export const listEventSchema = z.object({
  id: idSchema,
  listId: idSchema,
  /** `entity.verb`, pl. `list_item.updated`. */
  action: z.string(),
  entityType: z.string(),
  entityId: idSchema,
  actorType: z.enum(ACTOR_TYPES),
  actorId: idSchema,
  createdAt: z.string(),
})
export type ListEvent = z.infer<typeof listEventSchema>
