import { z } from 'zod'
import { BOARD_ROLES } from '../roles'
import {
  dateSchema,
  httpUrlSchema,
  idSchema,
  prioritySchema,
  tagColorSchema,
  titleSchema,
  visibilitySchema,
} from './common'

export const labelSchema = z.object({
  id: idSchema,
  boardId: idSchema,
  name: z.string(),
  color: tagColorSchema,
})
export type LabelDto = z.infer<typeof labelSchema>
export const createLabelSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: tagColorSchema,
})
export type CreateLabelInput = z.infer<typeof createLabelSchema>

export const checklistItemSchema = z.object({
  id: idSchema,
  checklistId: idSchema,
  text: z.string(),
  done: z.boolean(),
  position: z.string(),
})
export type ChecklistItemDto = z.infer<typeof checklistItemSchema>

export const checklistSchema = z.object({
  id: idSchema,
  cardId: idSchema,
  title: z.string(),
  position: z.string(),
  items: z.array(checklistItemSchema),
})
export type ChecklistDto = z.infer<typeof checklistSchema>

export const cardSchema = z.object({
  id: idSchema,
  columnId: idSchema,
  title: z.string(),
  description: z.string(),
  priority: prioritySchema,
  dueDate: dateSchema.nullable(),
  coverImage: z.string().nullable(),
  position: z.string(),
  labelIds: z.array(idSchema),
  checklists: z.array(checklistSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  version: z.number().int(),
})
export type CardDto = z.infer<typeof cardSchema>

export const columnSchema = z.object({
  id: idSchema,
  boardId: idSchema,
  title: z.string(),
  accent: tagColorSchema,
  isDone: z.boolean(),
  position: z.string(),
})
export type ColumnDto = z.infer<typeof columnSchema>

export const boardRoleSchema = z.enum(BOARD_ROLES)

export const boardSummarySchema = z.object({
  id: idSchema,
  workspaceId: idSchema,
  title: z.string(),
  visibility: visibilitySchema,
  createdAt: z.string(),
  /** A bejelentkezett felhasználó tényleges szerepköre a táblán (a UI ebből tiltja le a műveleteket). */
  myRole: boardRoleSchema,
  starred: z.boolean(),
})
export type BoardSummaryDto = z.infer<typeof boardSummarySchema>

export const boardSchema = boardSummarySchema.extend({
  labels: z.array(labelSchema),
  columns: z.array(columnSchema.extend({ cards: z.array(cardSchema) })),
})
export type BoardDto = z.infer<typeof boardSchema>

export const createBoardSchema = z.object({
  title: titleSchema,
  visibility: visibilitySchema.default('private'),
})
export type CreateBoardInput = z.infer<typeof createBoardSchema>
export const updateBoardSchema = z
  .object({ title: titleSchema, visibility: visibilitySchema })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'empty_update')
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>

export const createColumnSchema = z.object({
  title: titleSchema,
  accent: tagColorSchema.default('blue'),
  isDone: z.boolean().default(false),
})
export type CreateColumnInput = z.infer<typeof createColumnSchema>
export const updateColumnSchema = z
  .object({ title: titleSchema, accent: tagColorSchema, isDone: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'empty_update')
export type UpdateColumnInput = z.infer<typeof updateColumnSchema>
/** Oszlop törlésekor a kártyák ebbe az oszlopba kerülnek át. */
export const deleteColumnQuerySchema = z.object({ moveCardsTo: idSchema.optional() })

export const createCardSchema = z.object({
  title: titleSchema,
  description: z.string().max(10000).default(''),
  priority: prioritySchema.default('medium'),
  dueDate: dateSchema.nullish(),
  coverImage: httpUrlSchema.nullish(),
  labelIds: z.array(idSchema).default([]),
})
export type CreateCardInput = z.infer<typeof createCardSchema>
export const updateCardSchema = z
  .object({
    title: titleSchema,
    description: z.string().max(10000),
    priority: prioritySchema,
    dueDate: dateSchema.nullable(),
    coverImage: httpUrlSchema.nullable(),
    labelIds: z.array(idSchema),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'empty_update')
export type UpdateCardInput = z.infer<typeof updateCardSchema>

export const createChecklistSchema = z.object({ title: titleSchema.default('Checklist') })
export type CreateChecklistInput = z.infer<typeof createChecklistSchema>
export const updateChecklistSchema = z.object({ title: titleSchema })
export type UpdateChecklistInput = z.infer<typeof updateChecklistSchema>
export const createChecklistItemSchema = z.object({ text: z.string().trim().min(1).max(500) })
export type CreateChecklistItemInput = z.infer<typeof createChecklistItemSchema>
export const updateChecklistItemSchema = z
  .object({ text: z.string().trim().min(1).max(500), done: z.boolean() })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'empty_update')
export type UpdateChecklistItemInput = z.infer<typeof updateChecklistItemSchema>

/** Kártya áthelyezése: a `beforeCardId` elé kerül a cél oszlopban, ennek hiányában a végére. */
export const moveCardSchema = z.object({
  columnId: idSchema,
  beforeCardId: idSchema.nullish(),
})
export type MoveCardInput = z.infer<typeof moveCardSchema>

/** Oszlop áthelyezése: a `beforeColumnId` elé kerül, ennek hiányában a végére. */
export const moveColumnSchema = z.object({ beforeColumnId: idSchema.nullish() })
export type MoveColumnInput = z.infer<typeof moveColumnSchema>

export const boardListSchema = z.object({ data: z.array(boardSummarySchema) })

/** A kérés törzse, ahogy a kliens küldi (az alapértelmezések még kitöltetlenek). */
export type CreateColumnRequest = z.input<typeof createColumnSchema>
export type CreateCardRequest = z.input<typeof createCardSchema>
export type CreateChecklistRequest = z.input<typeof createChecklistSchema>

export const boardMemberSchema = z.object({
  userId: idSchema,
  name: z.string(),
  email: z.string(),
  avatarUrl: z.string().nullable(),
  role: boardRoleSchema,
})
export type BoardMemberDto = z.infer<typeof boardMemberSchema>
export const boardMemberListSchema = z.object({ data: z.array(boardMemberSchema) })

export const setBoardMemberSchema = z.object({ role: boardRoleSchema })
export type SetBoardMemberInput = z.infer<typeof setBoardMemberSchema>
