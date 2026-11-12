import type { BoardDto, CardDto } from '@taskflow/shared'
import type { Assignee, Columns, Task } from './types'

type Labels = BoardDto['labels']

const toTask = (
  card: CardDto,
  labels: Labels,
  done: boolean,
  participants: Map<string, Assignee>,
): Task => {
  const checklist = card.checklists[0]
  return {
    id: card.id,
    title: card.title,
    description: card.description,
    priority: card.priority,
    tags: card.labelIds.flatMap((id) => {
      const label = labels.find((item) => item.id === id)
      return label ? [{ label: label.name, color: label.color }] : []
    }),
    assignees: card.assigneeIds.map(
      (id) => participants.get(id) ?? { id, name: '?', avatarUrl: null },
    ),
    dueDate: card.dueDate ?? undefined,
    coverImage: card.coverImage ?? undefined,
    done,
    version: card.version,
    checklist: checklist && {
      title: checklist.title,
      items: checklist.items.map(({ id, text, done: itemDone }) => ({ id, text, done: itemDone })),
    },
  }
}

/** A szerver táblájából a UI nézetmodellje; az oszlopok és kártyák sorrendje a DTO tömbsorrendje. */
export const toColumns = (board: BoardDto, participants: Assignee[] = []): Columns => {
  const byId = new Map(participants.map((p) => [p.id, p]))
  const columns: Columns = {}
  for (const column of board.columns) {
    columns[column.id] = {
      title: column.title,
      accent: column.accent,
      done: column.isDone,
      tasks: column.cards.map((card) => toTask(card, board.labels, column.isDone, byId)),
    }
  }
  return columns
}
