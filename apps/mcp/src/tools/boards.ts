import { z } from 'zod'
import { resolveOne } from '../resolve.js'
import type { ToolContext } from './context.js'

const visibility = z.enum(['private', 'workspace', 'public'])

export function registerBoardTools({ define, api, snapshot, participants }: ToolContext) {
  define('list_workspaces', 'List the workspaces of the user (id, name, role).', {}, async () => {
    const { data } = await api.get<{ data: { id: string; name: string; role: string }[] }>(
      '/workspaces',
    )
    return data.map((w) => ({ id: w.id, name: w.name, role: w.role }))
  })

  define('list_boards', 'List the boards the user can access (id, title, role).', {}, async () => {
    const { data } = await api.get<{
      data: { id: string; title: string; myRole: string; workspaceId: string }[]
    }>('/boards')
    return data.map((b) => ({
      id: b.id,
      title: b.title,
      myRole: b.myRole,
      workspaceId: b.workspaceId,
    }))
  })

  define(
    'get_board_overview',
    "One-call overview of a board: columns with cards (id, title, priority, due date, labels, checklist progress), labels, summary stats, recent activity and the participants (who can be assigned or mentioned). Use get_card for a card's full description.",
    { boardId: z.string() },
    async ({ boardId }) => {
      const [snap, people] = await Promise.all([snapshot(boardId), participants(boardId)])
      return {
        ...snap,
        participants: people.map((p) => ({ id: p.userId, name: p.name, role: p.role })),
      }
    },
  )

  define(
    'create_board',
    'Create a new board. The workspace (name or id) may be omitted when the user has only one. New boards are private unless told otherwise. Optionally create columns right away.',
    {
      title: z.string().min(1).max(200),
      workspace: z.string().optional().describe('Workspace name or id'),
      visibility: visibility.optional(),
      columns: z.array(z.string().min(1)).optional().describe('Column names to create, in order'),
    },
    async (a) => {
      const { data } = await api.get<{ data: { id: string; name: string }[] }>('/workspaces')
      const ws = a.workspace
        ? resolveOne(
            'workspace',
            a.workspace,
            data,
            (w) => [w.name],
            (w) => w.id,
          )
        : data.length === 1
          ? data[0]!
          : resolveOne(
              'workspace',
              '',
              data,
              (w) => [w.name],
              (w) => w.id,
            )
      const board = await api.post<{ id: string; title: string }>(`/workspaces/${ws.id}/boards`, {
        title: a.title,
        visibility: a.visibility,
      })
      for (const title of a.columns ?? []) await api.post(`/boards/${board.id}/columns`, { title })
      return { boardId: board.id, title: board.title, workspace: ws.name }
    },
  )

  define(
    'update_board',
    'Rename a board and/or change its visibility.',
    {
      boardId: z.string(),
      title: z.string().min(1).max(200).optional(),
      visibility: visibility.optional(),
    },
    async ({ boardId, ...body }) => {
      const b = await api.patch<{ id: string; title: string; visibility: string }>(
        `/boards/${boardId}`,
        body,
      )
      return { updated: true, boardId: b.id, title: b.title, visibility: b.visibility }
    },
  )

  define(
    'archive_board',
    'Archive (hide) a board. Nothing is deleted permanently; restore_board brings it back. Ask the user to confirm first.',
    { boardId: z.string() },
    async ({ boardId }) => {
      await api.delete(`/boards/${boardId}`)
      return { archived: true, boardId }
    },
  )

  define(
    'list_archived_boards',
    'List archived boards of a workspace (to restore one).',
    { workspace: z.string().optional().describe('Workspace name or id; default: all') },
    async (a) => {
      const { data: wss } = await api.get<{ data: { id: string; name: string }[] }>('/workspaces')
      const chosen = a.workspace
        ? [
            resolveOne(
              'workspace',
              a.workspace,
              wss,
              (w) => [w.name],
              (w) => w.id,
            ),
          ]
        : wss
      const out: { id: string; title: string; workspace: string }[] = []
      for (const ws of chosen) {
        const { data } = await api.get<{ data: { id: string; title: string }[] }>(
          `/workspaces/${ws.id}/boards`,
          { archived: true },
        )
        out.push(...data.map((b) => ({ id: b.id, title: b.title, workspace: ws.name })))
      }
      return out
    },
  )

  define(
    'restore_board',
    'Restore an archived board.',
    { boardId: z.string() },
    async ({ boardId }) => {
      await api.post(`/boards/${boardId}/restore`)
      return { restored: true, boardId }
    },
  )

  define(
    'list_board_archive',
    'List the archived cards and columns of a board (to restore them).',
    { boardId: z.string() },
    async ({ boardId }) => {
      const a = await api.get<{
        cards: { id: string; title: string }[]
        columns: { id: string; title: string }[]
      }>(`/boards/${boardId}/archive`)
      return {
        cards: a.cards.map((c) => ({ id: c.id, title: c.title })),
        columns: a.columns.map((c) => ({ id: c.id, title: c.title })),
      }
    },
  )
}
