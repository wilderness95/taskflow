import { matchesBoardFilter, type BoardFilter, type Priority } from '@taskflow/shared'
import type { Columns, Task } from './types'

type PriorityLabel = (priority: Priority) => string

const matchesQuery = (task: Task, query: string, getPriorityLabel: PriorityLabel): boolean =>
  [
    task.title,
    task.description,
    getPriorityLabel(task.priority),
    task.dueDate,
    ...task.tags.map((tag) => tag.label),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(query)

/** A keresés a kártyák szövegére, prioritására, határidejére és címkéire szűr; az oszlopok megmaradnak. */
export const filterColumns = (
  columns: Columns,
  rawQuery: string,
  getPriorityLabel: PriorityLabel,
): Columns => {
  const query = rawQuery.trim().toLowerCase()
  if (!query) {
    return columns
  }

  return Object.fromEntries(
    Object.entries(columns).map(([columnId, column]) => [
      columnId,
      {
        ...column,
        tasks: column.tasks.filter((task) => matchesQuery(task, query, getPriorityLabel)),
      },
    ]),
  )
}

export const countTasks = (columns: Columns): number =>
  Object.values(columns).reduce((sum, column) => sum + column.tasks.length, 0)

/** A haladó szűrő (prioritás, címke, felelős, határidő); az üres szűrő az eredeti objektumot adja. */
export const applyBoardFilter = (columns: Columns, filter: BoardFilter, now?: Date): Columns => {
  const isActive =
    filter.priorities.length > 0 ||
    filter.labelIds.length > 0 ||
    filter.assigneeIds.length > 0 ||
    filter.due.length > 0
  if (!isActive) {
    return columns
  }

  return Object.fromEntries(
    Object.entries(columns).map(([columnId, column]) => [
      columnId,
      {
        ...column,
        tasks: column.tasks.filter((task) =>
          matchesBoardFilter(
            {
              priority: task.priority,
              labelIds: task.labelIds,
              assigneeIds: task.assignees.map((assignee) => assignee.id),
              dueDate: task.dueDate,
            },
            filter,
            now,
          ),
        ),
      },
    ]),
  )
}
