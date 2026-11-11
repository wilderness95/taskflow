import type { Priority } from '@taskflow/shared'
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
