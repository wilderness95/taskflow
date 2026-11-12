import type { Column, Columns, Task } from './types'

export const makeTask = (id: string, overrides: Partial<Task> = {}): Task => ({
  id,
  title: `Kártya ${id}`,
  description: '',
  priority: 'medium',
  tags: [],
  assignees: [],
  ...overrides,
})

export const makeColumn = (taskIds: string[], overrides: Partial<Column> = {}): Column => ({
  title: 'Oszlop',
  accent: 'blue',
  done: false,
  tasks: taskIds.map((id) => makeTask(id)),
  ...overrides,
})

export const taskIdsOf = (columns: Columns, columnId: string): string[] =>
  (columns[columnId]?.tasks ?? []).map((task) => task.id)
