import { z } from 'zod'
import { idSchema, prioritySchema } from './common'

const dueStateSchema = z.enum(['none', 'overdue', 'soon', 'normal'])

/** A haladó szűrő tárolt alakja (lásd `BoardFilter`); a hiányzó csoportok üresek. */
export const boardFilterSchema = z.object({
  priorities: z.array(prioritySchema).max(10).default([]),
  labelIds: z.array(idSchema).max(100).default([]),
  assigneeIds: z.array(idSchema).max(100).default([]),
  due: z.array(dueStateSchema).max(4).default([]),
})

/** Mentett szűrő: a felhasználó saját, táblánkénti szűrője. */
export const savedFilterSchema = z.object({
  id: idSchema,
  boardId: idSchema,
  name: z.string(),
  filter: boardFilterSchema,
  createdAt: z.string(),
})
export type SavedFilterDto = z.infer<typeof savedFilterSchema>
export const savedFilterListSchema = z.object({ data: z.array(savedFilterSchema) })

export const createSavedFilterSchema = z.object({
  name: z.string().trim().min(1).max(60),
  filter: boardFilterSchema,
})
export type CreateSavedFilterInput = z.infer<typeof createSavedFilterSchema>
export type CreateSavedFilterRequest = z.input<typeof createSavedFilterSchema>
