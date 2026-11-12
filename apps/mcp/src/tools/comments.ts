import { z } from 'zod'
import type { ToolContext } from './context.js'

const cardRef = z.string().describe('Card id, or (part of) its title when boardId is given')

export function registerCommentTools(ctx: ToolContext) {
  const { define, api, participants, userIds } = ctx

  define(
    'add_comment',
    'Add a comment to a card. People in `mentions` (names, emails or ids; needs boardId) get notified.',
    {
      card: cardRef,
      body: z.string().min(1).max(5000),
      boardId: z.string().optional(),
      mentions: z.array(z.string()).optional(),
    },
    async (a) => {
      let mentionIds: string[] = []
      if (a.mentions?.length) {
        if (!a.boardId) throw new Error('boardId is required to resolve mentions')
        mentionIds = userIds(await participants(a.boardId), a.mentions)
      }
      const card = await ctx.card(a.card, a.boardId)
      const c = await api.post<{ id: string }>(`/cards/${card.id}/comments`, {
        body: a.body,
        mentionIds,
      })
      return { commentId: c.id }
    },
  )

  define(
    'list_comments',
    'List the latest comments of a card (id, author, text).',
    { card: cardRef, boardId: z.string().optional() },
    async (a) => {
      const card = await ctx.card(a.card, a.boardId)
      const { data } = await api.get<{
        data: { id: string; authorName: string; body: string; createdAt: string }[]
      }>(`/cards/${card.id}/comments`, { limit: 20 })
      return data.map((c) => ({ id: c.id, author: c.authorName, body: c.body, at: c.createdAt }))
    },
  )

  define(
    'update_comment',
    'Edit the text of a comment (id from list_comments; only your own comments).',
    { commentId: z.string(), body: z.string().min(1).max(5000) },
    async (a) => {
      await api.patch(`/comments/${a.commentId}`, { body: a.body })
      return { updated: true }
    },
  )

  define(
    'delete_comment',
    'Delete a comment (id from list_comments). Ask the user to confirm first.',
    { commentId: z.string() },
    async (a) => {
      await api.delete(`/comments/${a.commentId}`)
      return { deleted: true }
    },
  )
}
