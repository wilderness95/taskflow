import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { ApiError, type ApiClient } from '../client.js'
import { ResolveError, resolveOne } from '../resolve.js'

export interface Snapshot {
  board: { id: string; title: string }
  labels: { id: string; name: string }[]
  columns: { id: string; title: string; isDone: boolean; cards: unknown[] }[]
  [k: string]: unknown
}
export interface Participant {
  userId: string
  name: string
  email: string
  role: string
}
export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}
export interface Checklist {
  id: string
  title: string
  items: ChecklistItem[]
}
export interface Card {
  id: string
  columnId: string
  title: string
  description: string
  priority: string
  dueDate: string | null
  version: number
  labelIds: string[]
  assigneeIds: string[]
  checklists: Checklist[]
}

export const priority = z.enum(['high', 'medium', 'low'])
/** Dátum: YYYY-MM-DD. Az üres szöveg vagy a `none` törli a határidőt (nullable séma helyett, mert a hangmodellek az egyszerű típusokat kezelik jól). */
export const dateText = z.string().describe('YYYY-MM-DD; empty string or "none" clears it')
export const parseDate = (value: string): string | null => {
  const v = value.trim().toLowerCase()
  if (v === '' || v === 'none') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v))
    throw new ResolveError(`Invalid date "${value}", use YYYY-MM-DD`)
  return v
}

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/i

const text = (value: unknown) => ({
  content: [
    { type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value) },
  ],
})

export function failure(err: unknown) {
  let message: string
  if (err instanceof ApiError) {
    message = `${err.code} (${err.status}): ${err.message}`
    if (err.details) message += ` ${JSON.stringify(err.details).slice(0, 300)}`
    if (err.code === 'version_conflict') message += ' - the card changed meanwhile, retry.'
  } else if (err instanceof ResolveError) message = err.message
  else message = err instanceof Error ? err.message : String(err)
  return { isError: true as const, content: [{ type: 'text' as const, text: message }] }
}

export interface ToolContext {
  api: ApiClient
  /** Eszköz regisztrálása: az API-hibákat tool-hibává képezi. */
  define<S extends z.ZodRawShape>(
    name: string,
    description: string,
    shape: S,
    fn: (args: z.infer<z.ZodObject<S>>) => Promise<unknown>,
  ): void
  snapshot(boardId: string): Promise<Snapshot>
  participants(boardId: string): Promise<Participant[]>
  column(snap: Snapshot, input: string): Snapshot['columns'][number]
  userIds(people: Participant[], inputs: string[]): string[]
  labelIds(snap: Snapshot, inputs: string[]): string[]
  /** Kártya azonosító vagy cím (részlet) alapján; címhez `boardId` kell. */
  card(ref: string, boardId?: string): Promise<Card>
}

export function createToolContext(server: McpServer, api: ApiClient): ToolContext {
  const snapshot = (boardId: string) => api.get<Snapshot>(`/boards/${boardId}/snapshot`)
  return {
    api,
    define(name, description, shape, fn) {
      server.registerTool(name, { description, inputSchema: shape }, (async (args: never) => {
        try {
          return text(await fn(args))
        } catch (err) {
          return failure(err)
        }
      }) as never)
    },
    snapshot,
    participants: async (boardId) =>
      (await api.get<{ data: Participant[] }>(`/boards/${boardId}/participants`)).data,
    column: (snap, input) =>
      resolveOne(
        'column',
        input,
        snap.columns,
        (c) => [c.title],
        (c) => c.id,
      ),
    userIds: (people, inputs) =>
      inputs.map(
        (i) =>
          resolveOne(
            'person',
            i,
            people,
            (p) => [p.name, p.email],
            (p) => p.userId,
          ).userId,
      ),
    labelIds: (snap, inputs) =>
      inputs.map(
        (i) =>
          resolveOne(
            'label',
            i,
            snap.labels,
            (l) => [l.name],
            (l) => l.id,
          ).id,
      ),
    async card(ref, boardId) {
      if (ULID.test(ref)) return api.get<Card>(`/cards/${ref}`)
      if (!boardId) throw new ResolveError('boardId is required to find a card by title')
      const { data } = await api.get<{ data: Card[] }>(`/boards/${boardId}/cards`, {
        q: ref,
        limit: 50,
      })
      return resolveOne(
        'card',
        ref,
        data,
        (c) => [c.title],
        (c) => c.id,
      )
    },
  }
}
