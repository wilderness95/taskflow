import type { BoardDto, CardDto } from '@taskflow/shared'
import * as api from '../../api/boards'
import type { Task } from '../boards/types'

export type SaveCardInput = {
  task: Task
  columnId: string
  /** Megléte esetén meglévő kártya szerkesztése, különben új kártya. */
  originalColumnId?: string
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** A szabad szöveges címkékhez a tábla címkéit rendeli; ami még nincs, azt létrehozza. */
async function resolveLabelIds(board: BoardDto, tags: Task['tags']): Promise<string[]> {
  const known = [...board.labels]
  const ids: string[] = []
  for (const tag of tags) {
    let label = known.find((item) => sameName(item.name, tag.label))
    if (!label) {
      label = await api.createLabel(board.id, { name: tag.label, color: tag.color })
      known.push(label)
    }
    if (!ids.includes(label.id)) {
      ids.push(label.id)
    }
  }
  return ids
}

/** A szerkesztő egyetlen checklistet kezel: a kártya első checklistjét hozza egyezésbe a piszkozattal. */
async function syncChecklist(card: CardDto, task: Task): Promise<void> {
  const title = task.checklist?.title ?? ''
  const items = task.checklist?.items ?? []
  let checklist = card.checklists[0]

  if (!checklist) {
    if (items.length === 0) {
      return
    }
    checklist = { ...(await api.createChecklist(card.id, { title })), items: [] }
  } else if (checklist.title !== title) {
    await api.updateChecklist(checklist.id, title)
  }

  const existing = new Map(checklist.items.map((item) => [item.id, item]))
  const keptIds = new Set(
    items.flatMap((item) => (item.id && existing.has(item.id) ? [item.id] : [])),
  )

  for (const item of checklist.items) {
    if (!keptIds.has(item.id)) {
      await api.deleteChecklistItem(item.id)
    }
  }

  for (const item of items) {
    const current = item.id ? existing.get(item.id) : undefined
    if (current) {
      if (current.text !== item.text || current.done !== item.done) {
        await api.updateChecklistItem(current.id, { text: item.text, done: item.done })
      }
    } else {
      const created = await api.createChecklistItem(checklist.id, { text: item.text })
      if (item.done) {
        await api.updateChecklistItem(created.id, { done: true })
      }
    }
  }
}

const findCard = (board: BoardDto, cardId: string): CardDto | undefined =>
  board.columns.flatMap((column) => column.cards).find((card) => card.id === cardId)

/**
 * Egy kártya mentése: címkék, mezők, oszlopváltás és checklist több API-hívásra bomlik.
 * Az új vagy oszlopot váltó kártya az oszlop elejére kerül (a korábbi UI-viselkedés).
 */
export async function saveCard(board: BoardDto, input: SaveCardInput): Promise<void> {
  const { task, columnId, originalColumnId } = input
  const labelIds = await resolveLabelIds(board, task.tags)
  const fields = {
    title: task.title,
    description: task.description,
    priority: task.priority,
    dueDate: task.dueDate || null,
    labelIds,
  }
  const firstCardId = (targetId: string) =>
    board.columns.find((column) => column.id === targetId)?.cards[0]?.id

  const existing = originalColumnId ? findCard(board, task.id) : undefined

  let card: CardDto
  if (existing) {
    card = await api.updateCard(existing.id, { ...fields, version: existing.version })
    if (columnId !== originalColumnId) {
      card = await api.moveCard(card.id, {
        columnId,
        beforeCardId: firstCardId(columnId),
        version: card.version,
      })
    }
    card = { ...card, checklists: existing.checklists }
  } else {
    const before = firstCardId(columnId)
    card = await api.createCard(columnId, fields)
    if (before) {
      await api.moveCard(card.id, { columnId, beforeCardId: before })
    }
  }

  await syncChecklist(card, task)
}
