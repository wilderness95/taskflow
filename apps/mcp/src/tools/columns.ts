import { TAG_COLORS } from '@taskflow/shared'
import { z } from 'zod'
import type { ToolContext } from './context.js'

const accent = z.enum(TAG_COLORS)

export function registerColumnTools({ define, api, snapshot, column }: ToolContext) {
  define(
    'create_column',
    'Add a column to a board (at the end). Set isDone for a "done" column.',
    {
      boardId: z.string(),
      title: z.string().min(1).max(200),
      accent: accent.optional(),
      isDone: z.boolean().optional(),
    },
    async ({ boardId, ...body }) => {
      const c = await api.post<{ id: string; title: string }>(`/boards/${boardId}/columns`, body)
      return { columnId: c.id, title: c.title }
    },
  )

  define(
    'update_column',
    'Rename a column, change its color or whether it is a "done" column.',
    {
      boardId: z.string(),
      column: z.string().describe('Column name or id'),
      title: z.string().min(1).max(200).optional(),
      accent: accent.optional(),
      isDone: z.boolean().optional(),
    },
    async ({ boardId, column: ref, ...body }) => {
      const col = column(await snapshot(boardId), ref)
      const c = await api.patch<{ id: string; title: string }>(`/columns/${col.id}`, body)
      return { updated: true, columnId: c.id, title: c.title }
    },
  )

  define(
    'move_column',
    'Reorder a column: put it before another column, or at the end when beforeColumn is omitted.',
    { boardId: z.string(), column: z.string(), beforeColumn: z.string().optional() },
    async (a) => {
      const snap = await snapshot(a.boardId)
      const col = column(snap, a.column)
      await api.post(`/columns/${col.id}/move`, {
        beforeColumnId: a.beforeColumn ? column(snap, a.beforeColumn).id : undefined,
      })
      return { moved: true, column: col.title }
    },
  )

  define(
    'archive_column',
    'Archive a column together with its cards (restore_column brings it back). Ask the user to confirm first.',
    { boardId: z.string(), column: z.string() },
    async (a) => {
      const col = column(await snapshot(a.boardId), a.column)
      await api.post(`/columns/${col.id}/archive`)
      return { archived: true, column: col.title }
    },
  )

  define(
    'restore_column',
    'Restore an archived column (id from list_board_archive).',
    { columnId: z.string() },
    async ({ columnId }) => {
      await api.post(`/columns/${columnId}/restore`)
      return { restored: true, columnId }
    },
  )

  define(
    'delete_column',
    'Permanently delete a column; its cards move to another column. Prefer archive_column. Ask the user to confirm first.',
    {
      boardId: z.string(),
      column: z.string(),
      moveCardsTo: z.string().describe('Column name or id receiving the cards'),
    },
    async (a) => {
      const snap = await snapshot(a.boardId)
      const col = column(snap, a.column)
      const target = column(snap, a.moveCardsTo)
      await api.delete(`/columns/${col.id}?moveCardsTo=${encodeURIComponent(target.id)}`)
      return { deleted: true, column: col.title, cardsMovedTo: target.title }
    },
  )
}
