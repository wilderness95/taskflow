import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { ApiError, type ApiClient } from './client.js'
import { ResolveError, resolveOne } from './resolve.js'

interface Snapshot {
  board: { id: string; title: string }
  labels: { id: string; name: string }[]
  columns: { id: string; title: string; isDone: boolean; cards: unknown[] }[]
  [k: string]: unknown
}
interface Participant {
  userId: string
  name: string
  email: string
  role: string
}
interface Card {
  id: string
  columnId: string
  title: string
  priority: string
  dueDate: string | null
  version: number
  checklists: { id: string }[]
  [k: string]: unknown
}

const priority = z.enum(['high', 'medium', 'low'])
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD')

const text = (value: unknown) => ({
  content: [
    { type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value) },
  ],
})

function fail(err: unknown) {
  let message: string
  if (err instanceof ApiError) {
    message = `${err.code} (${err.status}): ${err.message}`
    if (err.code === 'version_conflict') message += ' - the card changed meanwhile, retry.'
  } else if (err instanceof ResolveError) message = err.message
  else message = err instanceof Error ? err.message : String(err)
  return { isError: true as const, content: [{ type: 'text' as const, text: message }] }
}

/** Közös kezelő: az API-hibákat az MCP-nek megfelelő hibaválaszra képezi. */
function handler<A>(fn: (args: A) => Promise<unknown>) {
  return async (args: A) => {
    try {
      return text(await fn(args))
    } catch (err) {
      return fail(err)
    }
  }
}

export interface McpServerOptions {
  name?: string
  version?: string
}

/**
 * A TaskFlow MCP szervere: beszédbarát, összevont eszközök az API fölött. Az átvitelt
 * (stdio, memória) a hívó köti rá; a jogosultságot az `ApiClient` hitelesítése adja.
 */
export function createTaskflowMcpServer(api: ApiClient, opts: McpServerOptions = {}): McpServer {
  const server = new McpServer({ name: opts.name ?? 'taskflow', version: opts.version ?? '0.0.0' })

  const snapshot = (boardId: string) => api.get<Snapshot>(`/boards/${boardId}/snapshot`)
  const participants = async (boardId: string) =>
    (await api.get<{ data: Participant[] }>(`/boards/${boardId}/participants`)).data

  const findColumn = (snap: Snapshot, input: string) =>
    resolveOne(
      'column',
      input,
      snap.columns,
      (c) => [c.title],
      (c) => c.id,
    )
  const findUsers = (people: Participant[], inputs: string[]) =>
    inputs.map(
      (i) =>
        resolveOne(
          'person',
          i,
          people,
          (p) => [p.name, p.email],
          (p) => p.userId,
        ).userId,
    )
  const findLabels = (snap: Snapshot, inputs: string[]) =>
    inputs.map(
      (i) =>
        resolveOne(
          'label',
          i,
          snap.labels,
          (l) => [l.name],
          (l) => l.id,
        ).id,
    )

  server.registerTool(
    'list_boards',
    {
      description: 'List the boards the user can access (id, title, role).',
      inputSchema: {},
    },
    handler(async () => {
      const { data } = await api.get<{
        data: { id: string; title: string; myRole: string; workspaceId: string }[]
      }>('/boards')
      return data.map((b) => ({
        id: b.id,
        title: b.title,
        myRole: b.myRole,
        workspaceId: b.workspaceId,
      }))
    }),
  )

  server.registerTool(
    'get_board_overview',
    {
      description:
        'One-call overview of a board: columns with cards (title, priority, due date, labels, checklist progress), labels, summary stats, recent activity and the participants (who can be assigned or mentioned).',
      inputSchema: { boardId: z.string() },
    },
    handler(async ({ boardId }: { boardId: string }) => {
      const [snap, people] = await Promise.all([snapshot(boardId), participants(boardId)])
      return {
        ...snap,
        participants: people.map((p) => ({ id: p.userId, name: p.name, role: p.role })),
      }
    }),
  )

  server.registerTool(
    'create_card',
    {
      description:
        'Create a card in one step, including assignees, labels and a checklist. Column, labels and people may be given by name (accents and case are ignored).',
      inputSchema: {
        boardId: z.string(),
        column: z.string().describe('Column name or id'),
        title: z.string().min(1).max(200),
        description: z.string().max(10000).optional(),
        priority: priority.optional(),
        dueDate: date.optional(),
        labels: z.array(z.string()).optional().describe('Label names or ids'),
        assignees: z.array(z.string()).optional().describe('Participant names, emails or ids'),
        checklist: z
          .object({ title: z.string().optional(), items: z.array(z.string().min(1)).min(1) })
          .optional(),
      },
    },
    handler(
      async (a: {
        boardId: string
        column: string
        title: string
        description?: string
        priority?: 'high' | 'medium' | 'low'
        dueDate?: string
        labels?: string[]
        assignees?: string[]
        checklist?: { title?: string; items: string[] }
      }) => {
        // Először minden névfeloldás, hogy hibánál ne jöjjön létre fél kártya.
        const snap = await snapshot(a.boardId)
        const column = findColumn(snap, a.column)
        const labelIds = a.labels?.length ? findLabels(snap, a.labels) : []
        const assigneeIds = a.assignees?.length
          ? findUsers(await participants(a.boardId), a.assignees)
          : []
        const card = await api.post<Card>(`/columns/${column.id}/cards`, {
          title: a.title,
          description: a.description,
          priority: a.priority,
          dueDate: a.dueDate,
          labelIds,
          assigneeIds,
        })
        let checklistError: string | undefined
        if (a.checklist) {
          try {
            const cl = await api.post<{ id: string }>(`/cards/${card.id}/checklists`, {
              title: a.checklist.title,
            })
            for (const item of a.checklist.items) {
              await api.post(`/checklists/${cl.id}/items`, { text: item })
            }
          } catch (err) {
            checklistError = fail(err).content[0]!.text
          }
        }
        return {
          cardId: card.id,
          column: column.title,
          title: card.title,
          ...(checklistError
            ? { warning: `Card created, but the checklist failed: ${checklistError}` }
            : {}),
        }
      },
    ),
  )

  server.registerTool(
    'search_cards',
    {
      description:
        'Search cards on a board by text in the title or description, optionally by priority or due-date range.',
      inputSchema: {
        boardId: z.string(),
        query: z.string().optional(),
        priority: priority.optional(),
        dueBefore: date.optional(),
        dueAfter: date.optional(),
        limit: z.number().int().min(1).max(50).optional(),
      },
    },
    handler(
      async (a: {
        boardId: string
        query?: string
        priority?: 'high' | 'medium' | 'low'
        dueBefore?: string
        dueAfter?: string
        limit?: number
      }) => {
        const [page, snap] = await Promise.all([
          api.get<{ data: Card[] }>(`/boards/${a.boardId}/cards`, {
            q: a.query,
            priority: a.priority,
            dueBefore: a.dueBefore,
            dueAfter: a.dueAfter,
            limit: a.limit ?? 20,
          }),
          snapshot(a.boardId),
        ])
        const columnTitle = new Map(snap.columns.map((c) => [c.id, c.title]))
        return page.data.map((c) => ({
          id: c.id,
          title: c.title,
          column: columnTitle.get(c.columnId),
          priority: c.priority,
          dueDate: c.dueDate,
        }))
      },
    ),
  )

  server.registerTool(
    'move_card',
    {
      description:
        'Move a card to another column (by name or id), optionally before another card. boardId is needed when the column is given by name.',
      inputSchema: {
        cardId: z.string(),
        column: z.string().describe('Target column name or id'),
        boardId: z.string().optional(),
        beforeCardId: z.string().optional(),
      },
    },
    handler(
      async (a: { cardId: string; column: string; boardId?: string; beforeCardId?: string }) => {
        const card = await api.get<Card>(`/cards/${a.cardId}`)
        let columnId = a.column
        let columnTitle = a.column
        if (a.boardId) {
          const col = findColumn(await snapshot(a.boardId), a.column)
          columnId = col.id
          columnTitle = col.title
        }
        await api.post(`/cards/${card.id}/move`, {
          columnId,
          beforeCardId: a.beforeCardId,
          version: card.version,
        })
        return { moved: true, cardId: card.id, title: card.title, column: columnTitle }
      },
    ),
  )

  server.registerTool(
    'update_card',
    {
      description:
        'Update a card: title, description, priority, due date (null clears it), labels and assignees (replace the whole set). boardId is needed when labels or assignees are given by name.',
      inputSchema: {
        cardId: z.string(),
        boardId: z.string().optional(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(10000).optional(),
        priority: priority.optional(),
        dueDate: date.nullable().optional(),
        labels: z.array(z.string()).optional(),
        assignees: z.array(z.string()).optional(),
      },
    },
    handler(
      async (a: {
        cardId: string
        boardId?: string
        title?: string
        description?: string
        priority?: 'high' | 'medium' | 'low'
        dueDate?: string | null
        labels?: string[]
        assignees?: string[]
      }) => {
        const body: Record<string, unknown> = {
          title: a.title,
          description: a.description,
          priority: a.priority,
          dueDate: a.dueDate,
        }
        const needsNames = (a.labels?.length ?? 0) + (a.assignees?.length ?? 0) > 0
        if (needsNames && !a.boardId) {
          throw new ResolveError('boardId is required to resolve labels or assignees')
        }
        if (a.labels)
          body.labelIds = a.labels.length ? findLabels(await snapshot(a.boardId!), a.labels) : []
        if (a.assignees) {
          body.assigneeIds = a.assignees.length
            ? findUsers(await participants(a.boardId!), a.assignees)
            : []
        }
        for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k]
        const card = await api.get<Card>(`/cards/${a.cardId}`)
        const updated = await api.patch<Card>(`/cards/${card.id}`, {
          ...body,
          version: card.version,
        })
        return { updated: true, cardId: updated.id, title: updated.title }
      },
    ),
  )

  server.registerTool(
    'add_comment',
    {
      description:
        'Add a comment to a card. People in `mentions` (names, emails or ids; needs boardId) get notified.',
      inputSchema: {
        cardId: z.string(),
        body: z.string().min(1).max(5000),
        boardId: z.string().optional(),
        mentions: z.array(z.string()).optional(),
      },
    },
    handler(async (a: { cardId: string; body: string; boardId?: string; mentions?: string[] }) => {
      let mentionIds: string[] = []
      if (a.mentions?.length) {
        if (!a.boardId) throw new ResolveError('boardId is required to resolve mentions')
        mentionIds = findUsers(await participants(a.boardId), a.mentions)
      }
      const c = await api.post<{ id: string }>(`/cards/${a.cardId}/comments`, {
        body: a.body,
        mentionIds,
      })
      return { commentId: c.id }
    }),
  )

  return server
}
