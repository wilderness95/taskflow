import { z } from 'zod'
import { resolveOne } from '../resolve.js'
import type { Checklist, ToolContext } from './context.js'

const cardRef = z.string().describe('Card id, or (part of) its title when boardId is given')

export function registerChecklistTools(ctx: ToolContext) {
  const { define, api } = ctx

  const pickList = (lists: Checklist[], ref?: string) =>
    ref
      ? resolveOne(
          'checklist',
          ref,
          lists,
          (l) => [l.title],
          (l) => l.id,
        )
      : lists[0]

  define(
    'add_checklist_items',
    'Add items to a checklist of a card. Uses the named checklist, else the first one; creates a checklist when the card has none (or the name is new).',
    {
      card: cardRef,
      boardId: z.string().optional(),
      items: z.array(z.string().min(1)).min(1),
      checklist: z.string().optional().describe('Checklist title'),
    },
    async (a) => {
      const card = await ctx.card(a.card, a.boardId)
      let list = a.checklist
        ? card.checklists.find((l) => l.title.toLowerCase() === a.checklist!.toLowerCase())
        : card.checklists[0]
      if (!list) {
        list = {
          ...(await api.post<Checklist>(`/cards/${card.id}/checklists`, { title: a.checklist })),
          items: [],
        }
      }
      for (const text of a.items) await api.post(`/checklists/${list.id}/items`, { text })
      return { added: a.items.length, checklist: list.title, card: card.title }
    },
  )

  define(
    'update_checklist_item',
    'Tick or untick a checklist item, rename it, or remove it. The item is found by its text (part of it is enough).',
    {
      card: cardRef,
      boardId: z.string().optional(),
      item: z.string().describe('Text of the checklist item'),
      done: z.boolean().optional(),
      text: z.string().min(1).max(500).optional().describe('New text'),
      remove: z.boolean().optional().describe('true: delete the item'),
    },
    async (a) => {
      const card = await ctx.card(a.card, a.boardId)
      const items = card.checklists.flatMap((l) => l.items)
      const item = resolveOne(
        'checklist item',
        a.item,
        items,
        (i) => [i.text],
        (i) => i.id,
      )
      if (a.remove) {
        await api.delete(`/checklist-items/${item.id}`)
        return { removed: item.text }
      }
      if (a.done === undefined && a.text === undefined) throw new Error('Give done, text or remove')
      await api.patch(`/checklist-items/${item.id}`, { done: a.done, text: a.text })
      return { updated: item.text, ...(a.done !== undefined ? { done: a.done } : {}) }
    },
  )

  define(
    'update_checklist',
    'Rename a checklist of a card, or delete the whole checklist.',
    {
      card: cardRef,
      boardId: z.string().optional(),
      checklist: z.string().optional().describe('Checklist title (default: the first)'),
      title: z.string().min(1).max(200).optional(),
      remove: z.boolean().optional(),
    },
    async (a) => {
      const card = await ctx.card(a.card, a.boardId)
      const list = pickList(card.checklists, a.checklist)
      if (!list) throw new Error('The card has no checklist')
      if (a.remove) {
        await api.delete(`/checklists/${list.id}`)
        return { removed: list.title }
      }
      if (!a.title) throw new Error('Give a new title or remove')
      await api.patch(`/checklists/${list.id}`, { title: a.title })
      return { renamed: a.title }
    },
  )
}
