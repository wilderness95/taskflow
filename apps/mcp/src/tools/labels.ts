import { TAG_COLORS } from '@taskflow/shared'
import { z } from 'zod'
import { resolveOne } from '../resolve.js'
import type { ToolContext } from './context.js'

const color = z.enum(TAG_COLORS)

export function registerLabelTools({ define, api, snapshot }: ToolContext) {
  define(
    'create_label',
    'Create a label on a board.',
    { boardId: z.string(), name: z.string().min(1).max(50), color },
    async ({ boardId, ...body }) => {
      const l = await api.post<{ id: string; name: string }>(`/boards/${boardId}/labels`, body)
      return { labelId: l.id, name: l.name }
    },
  )

  const find = async (boardId: string, ref: string) =>
    resolveOne(
      'label',
      ref,
      (await snapshot(boardId)).labels,
      (l) => [l.name],
      (l) => l.id,
    )

  define(
    'update_label',
    'Rename a label or change its color.',
    {
      boardId: z.string(),
      label: z.string().describe('Label name or id'),
      name: z.string().min(1).max(50).optional(),
      color: color.optional(),
    },
    async ({ boardId, label, ...body }) => {
      const l = await find(boardId, label)
      await api.patch(`/labels/${l.id}`, body)
      return { updated: true, labelId: l.id }
    },
  )

  define(
    'delete_label',
    'Delete a label (it is removed from all cards). Ask the user to confirm first.',
    { boardId: z.string(), label: z.string() },
    async ({ boardId, label }) => {
      const l = await find(boardId, label)
      await api.delete(`/labels/${l.id}`)
      return { deleted: true, name: l.name }
    },
  )
}
