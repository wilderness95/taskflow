import { priorityLabels } from '../cards/priorityLabels'
import type { Columns, Task } from './types'

const matchesQuery = (task: Task, query: string): boolean =>
  [
    task.title,
    task.description,
    priorityLabels[task.priority],
    task.dueDate,
    ...task.tags.map((tag) => tag.label),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(query)

/** A keresés a kártyák szövegére, prioritására, határidejére és címkéire szűr; az oszlopok megmaradnak. */
export const filterColumns = (columns: Columns, rawQuery: string): Columns => {
  const query = rawQuery.trim().toLowerCase()
  if (!query) {
    return columns
  }

  return Object.fromEntries(
    Object.entries(columns).map(([columnId, column]) => [
      columnId,
      { ...column, tasks: column.tasks.filter((task) => matchesQuery(task, query)) },
    ]),
  )
}

export const countTasks = (columns: Columns): number =>
  Object.values(columns).reduce((sum, column) => sum + column.tasks.length, 0)
