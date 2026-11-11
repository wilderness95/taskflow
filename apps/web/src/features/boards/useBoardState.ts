import { useMemo, useReducer } from 'react'
import { createId } from '../../shared/lib/ids'
import { boardReducer } from './boardReducer'
import { initialColumns } from './boardSeed'
import type { ColumnAccent, Columns, Task } from './types'

export function useBoardState(initialState: Columns = initialColumns) {
  const [columns, dispatch] = useReducer(boardReducer, initialState)

  const actions = useMemo(
    () => ({
      addColumn: (title: string, accent: ColumnAccent) =>
        dispatch({ type: 'column/added', columnId: createId('column'), title, accent }),
      updateColumn: (columnId: string, title: string, accent: ColumnAccent) =>
        dispatch({ type: 'column/updated', columnId, title, accent }),
      deleteColumn: (columnId: string) => dispatch({ type: 'column/deleted', columnId }),
      reorderColumns: (sourceColumnId: string, targetColumnId: string) =>
        dispatch({ type: 'column/reordered', sourceColumnId, targetColumnId }),
      saveTask: (task: Task, columnId: string, originalColumnId?: string) =>
        dispatch({ type: 'task/saved', task, columnId, originalColumnId }),
      deleteTask: (columnId: string, taskId: string) =>
        dispatch({ type: 'task/deleted', columnId, taskId }),
      moveTask: (
        taskId: string,
        fromColumnId: string,
        toColumnId: string,
        targetTaskId: string | null = null,
      ) => dispatch({ type: 'task/moved', taskId, fromColumnId, toColumnId, targetTaskId }),
    }),
    [],
  )

  return { columns, ...actions }
}
