import { z } from 'zod'
import { idSchema } from './common'

export const commentSchema = z.object({
  id: idSchema,
  cardId: idSchema,
  authorId: idSchema,
  authorName: z.string(),
  authorAvatarUrl: z.string().nullable(),
  /** A hozzászólást API kulcs (pl. AI agent) írta a szerző nevében. */
  viaApiKey: z.boolean(),
  body: z.string(),
  /** A megemlített felhasználók (a tábla résztvevői); a szövegben `@Név` formában szerepelnek. */
  mentionIds: z.array(idSchema),
  createdAt: z.string(),
  /** Szerkesztés időpontja; `null`, ha nem szerkesztették. */
  editedAt: z.string().nullable(),
})
export type CommentDto = z.infer<typeof commentSchema>

const commentBodySchema = z.string().trim().min(1).max(5000)

export const createCommentSchema = z.object({
  body: commentBodySchema,
  mentionIds: z.array(idSchema).max(50).default([]),
})
export type CreateCommentInput = z.infer<typeof createCommentSchema>
export type CreateCommentRequest = z.input<typeof createCommentSchema>

export const updateCommentSchema = z
  .object({ body: commentBodySchema, mentionIds: z.array(idSchema).max(50) })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'empty_update')
export type UpdateCommentInput = z.infer<typeof updateCommentSchema>

export const commentListSchema = z.object({
  data: z.array(commentSchema),
  nextCursor: z.string().nullable(),
})
