import { z } from 'zod'
import { activitySchema, pageQuerySchema } from './activity'
import { boardRoleSchema, cardSchema, labelSchema } from './board'
import { dateSchema, idSchema, prioritySchema, visibilitySchema } from './common'

/** Kártyák listázása egy táblán: szűrők + cursor-lapozás. */
export const cardListQuerySchema = pageQuerySchema.extend({
  columnId: idSchema.optional(),
  priority: prioritySchema.optional(),
  labelId: idSchema.optional(),
  /** Határidő legkésőbb ekkor (`YYYY-MM-DD`, bezárólag). */
  dueBefore: dateSchema.optional(),
  /** Határidő legkorábban ekkor (`YYYY-MM-DD`, bezárólag). */
  dueAfter: dateSchema.optional(),
  /** Részszöveg a címben vagy a leírásban (kis- és nagybetűre érzéketlen). */
  q: z.string().trim().min(1).max(200).optional(),
})
export type CardListQuery = z.infer<typeof cardListQuerySchema>

export const cardListSchema = z.object({
  data: z.array(cardSchema),
  nextCursor: z.string().nullable(),
})

const snapshotCardSchema = z.object({
  id: idSchema,
  title: z.string(),
  priority: prioritySchema,
  dueDate: dateSchema.nullable(),
  /** A határidő lejárt és a kártya nincs kész („done”) oszlopban. */
  overdue: z.boolean(),
  labels: z.array(z.string()),
  assigneeIds: z.array(idSchema),
  checklist: z.object({ done: z.number().int(), total: z.number().int() }),
  /** A leírás eleje; a teljes szöveg a `GET /cards/{id}` végponton. */
  descriptionExcerpt: z.string(),
  updatedAt: z.string(),
})

/** Agent-barát, tömör összefoglaló egy tábláról: egy kéréssel áttekinthető a teljes állapot. */
export const boardSnapshotSchema = z.object({
  generatedAt: z.string(),
  board: z.object({
    id: idSchema,
    workspaceId: idSchema,
    title: z.string(),
    visibility: visibilitySchema,
    myRole: boardRoleSchema,
  }),
  summary: z.object({
    columnCount: z.number().int(),
    cardCount: z.number().int(),
    doneCount: z.number().int(),
    overdueCount: z.number().int(),
    byPriority: z.record(prioritySchema, z.number().int()),
  }),
  labels: z.array(labelSchema),
  columns: z.array(
    z.object({
      id: idSchema,
      title: z.string(),
      isDone: z.boolean(),
      cardCount: z.number().int(),
      cards: z.array(snapshotCardSchema),
    }),
  ),
  recentActivity: z.array(activitySchema),
})
export type BoardSnapshotDto = z.infer<typeof boardSnapshotSchema>
