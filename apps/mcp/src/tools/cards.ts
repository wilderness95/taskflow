import { z } from 'zod'
import { dateText, parseDate, priority, type Card, type ToolContext } from './context.js'

const cardRef = z.string().describe('Card id, or (part of) its title when boardId is known')
const boardOpt = z.string().optional()

export function registerCardTools(ctx: ToolContext) {
  const { define, api, snapshot, participants, column, userIds, labelIds } = ctx

  define(
    'get_card',
    'Full details of one card: description, priority, due date, labels, assignees and checklists with their items.',
    { card: cardRef, boardId: boardOpt },
    async ({ card, boardId }) => {
      const c = await ctx.card(card, boardId)
      const snap = boardId ? await snapshot(boardId) : undefined
      const people = boardId ? await participants(boardId) : []
      const labelName = new Map(snap?.labels.map((l) => [l.id, l.name]))
      const personName = new Map(people.map((p) => [p.userId, p.name]))
      return {
        id: c.id,
        title: c.title,
        description: c.description,
        priority: c.priority,
        dueDate: c.dueDate,
        column: snap?.columns.find((col) => col.id === c.columnId)?.title ?? c.columnId,
        labels: c.labelIds.map((id) => labelName.get(id) ?? id),
        assignees: c.assigneeIds.map((id) => personName.get(id) ?? id),
        checklists: c.checklists.map((l) => ({
          title: l.title,
          items: l.items.map((i) => ({ text: i.text, done: i.done })),
        })),
      }
    },
  )

  define(
    'create_card',
    'Create a card in one step, including assignees, labels and a checklist. Column, labels and people may be given by name (accents and case are ignored).',
    {
      boardId: z.string(),
      column: z.string().describe('Column name or id'),
      title: z.string().min(1).max(200),
      description: z.string().max(10000).optional(),
      priority: priority.optional(),
      dueDate: dateText.optional(),
      labels: z.array(z.string()).optional().describe('Label names or ids'),
      assignees: z.array(z.string()).optional().describe('Participant names, emails or ids'),
      checklist: z
        .object({ title: z.string().optional(), items: z.array(z.string().min(1)).min(1) })
        .optional(),
    },
    async (a) => {
      // Először minden névfeloldás, hogy hibánál ne jöjjön létre fél kártya.
      const snap = await snapshot(a.boardId)
      const col = column(snap, a.column)
      const lIds = a.labels?.length ? labelIds(snap, a.labels) : []
      const aIds = a.assignees?.length ? userIds(await participants(a.boardId), a.assignees) : []
      const card = await api.post<Card>(`/columns/${col.id}/cards`, {
        title: a.title,
        description: a.description,
        priority: a.priority,
        dueDate: a.dueDate ? parseDate(a.dueDate) : undefined,
        labelIds: lIds,
        assigneeIds: aIds,
      })
      let warning: string | undefined
      if (a.checklist) {
        try {
          const cl = await api.post<{ id: string }>(`/cards/${card.id}/checklists`, {
            title: a.checklist.title,
          })
          for (const text of a.checklist.items)
            await api.post(`/checklists/${cl.id}/items`, { text })
        } catch (err) {
          warning = `Card created, but the checklist failed: ${err instanceof Error ? err.message : err}`
        }
      }
      return {
        cardId: card.id,
        column: col.title,
        title: card.title,
        ...(warning ? { warning } : {}),
      }
    },
  )

  define(
    'search_cards',
    'Search cards on a board by text in the title or description, optionally by priority or due-date range.',
    {
      boardId: z.string(),
      query: z.string().optional(),
      priority: priority.optional(),
      dueBefore: dateText.optional(),
      dueAfter: dateText.optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    async (a) => {
      const [page, snap] = await Promise.all([
        api.get<{ data: Card[] }>(`/boards/${a.boardId}/cards`, {
          q: a.query,
          priority: a.priority,
          dueBefore: a.dueBefore ? (parseDate(a.dueBefore) ?? undefined) : undefined,
          dueAfter: a.dueAfter ? (parseDate(a.dueAfter) ?? undefined) : undefined,
          limit: a.limit ?? 20,
        }),
        snapshot(a.boardId),
      ])
      const title = new Map(snap.columns.map((c) => [c.id, c.title]))
      return page.data.map((c) => ({
        id: c.id,
        title: c.title,
        column: title.get(c.columnId),
        priority: c.priority,
        dueDate: c.dueDate,
      }))
    },
  )

  define(
    'move_card',
    'Move a card to another column (by name or id), optionally before another card of that column.',
    {
      card: cardRef,
      column: z.string().describe('Target column name or id'),
      boardId: boardOpt,
      beforeCard: z.string().optional().describe('Title or id of the card to insert before'),
    },
    async (a) => {
      const card = await ctx.card(a.card, a.boardId)
      let columnId = a.column
      let columnTitle = a.column
      let before: string | undefined
      if (a.boardId) {
        const col = column(await snapshot(a.boardId), a.column)
        columnId = col.id
        columnTitle = col.title
        if (a.beforeCard) before = (await ctx.card(a.beforeCard, a.boardId)).id
      } else if (a.beforeCard) before = a.beforeCard
      await api.post(`/cards/${card.id}/move`, {
        columnId,
        beforeCardId: before,
        version: card.version,
      })
      return { moved: true, title: card.title, column: columnTitle }
    },
  )

  define(
    'update_card',
    'Update any field of a card: title, description, priority, due date (empty string clears it), labels and assignees (each replaces the whole set; empty list clears). Only the given fields change. boardId is needed to find the card by title or to resolve label/person names.',
    {
      card: cardRef,
      boardId: boardOpt,
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(10000).optional(),
      priority: priority.optional(),
      dueDate: dateText.optional(),
      labels: z.array(z.string()).optional(),
      assignees: z.array(z.string()).optional(),
    },
    async (a) => {
      const body: Record<string, unknown> = {
        title: a.title,
        description: a.description,
        priority: a.priority,
      }
      if (a.dueDate !== undefined) body.dueDate = parseDate(a.dueDate)
      if ((a.labels || a.assignees) && !a.boardId) {
        throw new Error('boardId is required to resolve labels or assignees')
      }
      if (a.labels)
        body.labelIds = a.labels.length ? labelIds(await snapshot(a.boardId!), a.labels) : []
      if (a.assignees)
        body.assigneeIds = a.assignees.length
          ? userIds(await participants(a.boardId!), a.assignees)
          : []
      for (const k of Object.keys(body)) if (body[k] === undefined) delete body[k]
      if (Object.keys(body).length === 0)
        throw new Error('Nothing to update: give at least one field')
      const card = await ctx.card(a.card, a.boardId)
      const u = await api.patch<Card>(`/cards/${card.id}`, { ...body, version: card.version })
      return { updated: Object.keys(body), cardId: u.id, title: u.title }
    },
  )

  define(
    'archive_card',
    'Archive a card (hide it; restore_card brings it back). Ask the user to confirm first.',
    { card: cardRef, boardId: boardOpt },
    async (a) => {
      const c = await ctx.card(a.card, a.boardId)
      await api.post(`/cards/${c.id}/archive`)
      return { archived: true, title: c.title }
    },
  )

  define(
    'restore_card',
    'Restore an archived card to the end of its column (id from list_board_archive).',
    { cardId: z.string() },
    async ({ cardId }) => {
      await api.post(`/cards/${cardId}/restore`)
      return { restored: true, cardId }
    },
  )

  define(
    'delete_card',
    'Permanently delete a card with its comments, checklists and attachments. Prefer archive_card. Ask the user to confirm first.',
    { card: cardRef, boardId: boardOpt },
    async (a) => {
      const c = await ctx.card(a.card, a.boardId)
      await api.delete(`/cards/${c.id}`)
      return { deleted: true, title: c.title }
    },
  )
}
