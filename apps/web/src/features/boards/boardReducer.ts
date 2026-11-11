import type { Column, ColumnAccent, Columns, Task } from './types'

export type BoardAction =
  | { type: 'column/added'; columnId: string; title: string; accent: ColumnAccent }
  | { type: 'column/updated'; columnId: string; title: string; accent: ColumnAccent }
  | { type: 'column/deleted'; columnId: string }
  | { type: 'column/reordered'; sourceColumnId: string; targetColumnId: string }
  /** `originalColumnId` megléte esetén meglévő kártya szerkesztése, különben új kártya. */
  | { type: 'task/saved'; task: Task; columnId: string; originalColumnId?: string }
  | { type: 'task/deleted'; columnId: string; taskId: string }
  | {
      type: 'task/moved'
      taskId: string
      fromColumnId: string
      toColumnId: string
      targetTaskId?: string | null
    }

const withTasks = (column: Column, tasks: Task[]): Column => ({ ...column, tasks })

/** A törölt oszlop kártyái a szomszédos (előző, ennek hiányában a következő) oszlop végére kerülnek. */
const deleteColumn = (state: Columns, columnId: string): Columns => {
  const orderedIds = Object.keys(state)
  const index = orderedIds.indexOf(columnId)
  const removed = state[columnId]

  if (index === -1 || !removed || orderedIds.length <= 1) {
    return state
  }

  const next = { ...state }
  delete next[columnId]

  const fallbackId = orderedIds[index - 1] ?? orderedIds[index + 1]
  const fallback = fallbackId ? next[fallbackId] : undefined
  if (fallbackId && fallback) {
    next[fallbackId] = withTasks(fallback, [...fallback.tasks, ...removed.tasks])
  }

  return next
}

const reorderColumns = (state: Columns, sourceId: string, targetId: string): Columns => {
  const orderedIds = Object.keys(state)
  const sourceIndex = orderedIds.indexOf(sourceId)
  const targetIndex = orderedIds.indexOf(targetId)

  if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) {
    return state
  }

  const [movedId] = orderedIds.splice(sourceIndex, 1)
  if (movedId === undefined) {
    return state
  }
  orderedIds.splice(targetIndex, 0, movedId)

  const next: Columns = {}
  for (const id of orderedIds) {
    const column = state[id]
    if (column) {
      next[id] = column
    }
  }
  return next
}

const saveTask = (
  state: Columns,
  { task, columnId, originalColumnId }: Extract<BoardAction, { type: 'task/saved' }>,
): Columns => {
  const target = state[columnId]
  if (!target) {
    return state
  }

  const original = originalColumnId ? state[originalColumnId] : undefined
  const originalIndex = original ? original.tasks.findIndex((item) => item.id === task.id) : -1

  if (originalColumnId && original && originalIndex >= 0) {
    const updated: Task = { ...original.tasks[originalIndex], ...task }

    if (columnId === originalColumnId) {
      const tasks = [...original.tasks]
      tasks[originalIndex] = updated
      return { ...state, [columnId]: withTasks(original, tasks) }
    }

    return {
      ...state,
      [originalColumnId]: withTasks(
        original,
        original.tasks.filter((item) => item.id !== task.id),
      ),
      [columnId]: withTasks(target, [updated, ...target.tasks]),
    }
  }

  return { ...state, [columnId]: withTasks(target, [task, ...target.tasks]) }
}

/** A kártya a célkártya elé kerül; ha nincs (vagy nem található) célkártya, az oszlop végére. */
const moveTask = (
  state: Columns,
  { taskId, fromColumnId, toColumnId, targetTaskId }: Extract<BoardAction, { type: 'task/moved' }>,
): Columns => {
  const source = state[fromColumnId]
  const target = state[toColumnId]
  if (!source || !target) {
    return state
  }

  const sourceTasks = [...source.tasks]
  const sourceIndex = sourceTasks.findIndex((item) => item.id === taskId)
  const [taskToMove] = sourceIndex >= 0 ? sourceTasks.splice(sourceIndex, 1) : []
  if (!taskToMove) {
    return state
  }

  const moved: Task = { ...taskToMove, done: target.done }

  const insertInto = (tasks: Task[]): Task[] => {
    const next = [...tasks]
    const index = targetTaskId ? next.findIndex((item) => item.id === targetTaskId) : -1
    next.splice(index >= 0 ? index : next.length, 0, moved)
    return next
  }

  if (fromColumnId === toColumnId) {
    return { ...state, [fromColumnId]: withTasks(source, insertInto(sourceTasks)) }
  }

  return {
    ...state,
    [fromColumnId]: withTasks(source, sourceTasks),
    [toColumnId]: withTasks(target, insertInto(target.tasks)),
  }
}

export function boardReducer(state: Columns, action: BoardAction): Columns {
  switch (action.type) {
    case 'column/added':
      return {
        ...state,
        [action.columnId]: { title: action.title, accent: action.accent, done: false, tasks: [] },
      }

    case 'column/updated': {
      const column = state[action.columnId]
      if (!column) {
        return state
      }
      return {
        ...state,
        [action.columnId]: { ...column, title: action.title, accent: action.accent },
      }
    }

    case 'column/deleted':
      return deleteColumn(state, action.columnId)

    case 'column/reordered':
      return reorderColumns(state, action.sourceColumnId, action.targetColumnId)

    case 'task/saved':
      return saveTask(state, action)

    case 'task/deleted': {
      const column = state[action.columnId]
      if (!column) {
        return state
      }
      return {
        ...state,
        [action.columnId]: withTasks(
          column,
          column.tasks.filter((item) => item.id !== action.taskId),
        ),
      }
    }

    case 'task/moved':
      return moveTask(state, action)
  }
}
