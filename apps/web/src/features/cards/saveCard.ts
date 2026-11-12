import type { BoardDto, CardDto, ChecklistDto } from '@taskflow/shared'
import * as api from '../../api/boards'
import type { Task, TaskChecklist } from '../boards/types'

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

/** Egy checklist tételeit hozza egyezésbe a szerkesztő tartalmával (törlés, módosítás, létrehozás). */
async function syncItems(
  checklistId: string,
  current: ChecklistDto['items'],
  items: TaskChecklist['items'],
): Promise<void> {
  const existing = new Map(current.map((item) => [item.id, item]))
  const keptIds = new Set(
    items.flatMap((item) => (item.id && existing.has(item.id) ? [item.id] : [])),
  )

  for (const item of current) {
    if (!keptIds.has(item.id)) {
      await api.deleteChecklistItem(item.id)
    }
  }

  for (const item of items) {
    const known = item.id ? existing.get(item.id) : undefined
    if (known) {
      if (known.text !== item.text || known.done !== item.done) {
        await api.updateChecklistItem(known.id, { text: item.text, done: item.done })
      }
    } else {
      const created = await api.createChecklistItem(checklistId, { text: item.text })
      if (item.done) {
        await api.updateChecklistItem(created.id, { done: true })
      }
    }
  }
}

/**
 * A kártya checklistjeit hozza egyezésbe a szerkesztővel: a szerveren meglévő, de a szerkesztőből
 * hiányzó listák törlődnek, az újak létrejönnek (a sorrend a létrehozás sorrendje), a többi frissül.
 */
async function syncChecklists(card: CardDto, task: Task): Promise<void> {
  const existing = new Map(card.checklists.map((list) => [list.id, list]))
  const keptIds = new Set(task.checklists.filter((list) => existing.has(list.id)).map((l) => l.id))

  for (const list of card.checklists) {
    if (!keptIds.has(list.id)) {
      await api.deleteChecklist(list.id)
    }
  }

  for (const list of task.checklists) {
    const current = existing.get(list.id)
    if (current) {
      if (current.title !== list.title) {
        await api.updateChecklist(current.id, list.title)
      }
      await syncItems(current.id, current.items, list.items)
    } else {
      const created = await api.createChecklist(card.id, { title: list.title })
      await syncItems(created.id, [], list.items)
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
    assigneeIds: task.assignees.map((assignee) => assignee.id),
  }
  const firstCardId = (targetId: string) =>
    board.columns.find((column) => column.id === targetId)?.cards[0]?.id

  const existing = originalColumnId ? findCard(board, task.id) : undefined

  let card: CardDto
  if (existing) {
    card = await api.updateCard(existing.id, {
      ...fields,
      version: task.version ?? existing.version,
    })
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

  await syncChecklists(card, task)
}
