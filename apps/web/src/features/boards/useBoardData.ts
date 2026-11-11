import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { BoardDto } from '@taskflow/shared'
import { useMemo, useState } from 'react'
import * as api from '../../api/boards'
import { saveCard, type SaveCardInput } from '../cards/saveCard'
import { toColumns } from './boardMapper'
import type { BoardView, ColumnAccent, Visibility } from './types'

const boardsKey = ['boards'] as const
const boardKey = (boardId: string) => ['board', boardId] as const

/** M1: még nincs táblalista oldal, a felhasználó első táblája nyílik meg. */
export function useBoardData() {
  const queryClient = useQueryClient()

  const boards = useQuery({ queryKey: boardsKey, queryFn: api.listBoards })
  const boardId = boards.data?.[0]?.id

  const boardQuery = useQuery({
    queryKey: boardKey(boardId ?? ''),
    queryFn: () => api.getBoard(boardId ?? ''),
    enabled: Boolean(boardId),
  })
  const board = boardQuery.data

  const refresh = () => queryClient.invalidateQueries({ queryKey: boardKey(boardId ?? '') })
  // Minden írás után a szerver állapota az igazság.
  const useWrite = <TVars>(fn: (vars: TVars) => Promise<unknown>) =>
    useMutation({ mutationFn: fn, onSettled: refresh })

  const addColumn = useWrite(({ title, accent }: { title: string; accent: ColumnAccent }) =>
    api.createColumn(boardId ?? '', { title, accent }),
  )
  const updateColumn = useWrite(
    ({ columnId, title, accent }: { columnId: string; title: string; accent: ColumnAccent }) =>
      api.updateColumn(columnId, { title, accent }),
  )
  const deleteColumn = useWrite((columnId: string) => {
    const ids = board?.columns.map((column) => column.id) ?? []
    const index = ids.indexOf(columnId)
    const hasCards = (board?.columns[index]?.cards.length ?? 0) > 0
    // A kártyák az előző (ennek hiányában a következő) oszlopba kerülnek.
    const fallback = ids[index - 1] ?? ids[index + 1]
    return api.deleteColumn(columnId, hasCards ? fallback : undefined)
  })
  const moveColumn = useWrite(
    ({ columnId, beforeColumnId }: { columnId: string; beforeColumnId: string | null }) =>
      api.moveColumn(columnId, { beforeColumnId }),
  )
  const saveTask = useWrite((input: SaveCardInput) => saveCard(board as BoardDto, input))
  const deleteTask = useWrite((taskId: string) => api.deleteCard(taskId))
  const moveTask = useWrite(
    ({
      taskId,
      toColumnId,
      targetTaskId,
    }: {
      taskId: string
      toColumnId: string
      targetTaskId: string | null
    }) => api.moveCard(taskId, { columnId: toColumnId, beforeCardId: targetTaskId }),
  )
  const updateBoard = useWrite((input: { title?: string; visibility?: Visibility }) =>
    api.updateBoard(boardId ?? '', input),
  )

  const columns = useMemo(() => (board ? toColumns(board) : {}), [board])

  // A csillagozás és a nézetválasztó egyelőre kliensoldali állapot (board_stars: M3).
  const [isStarred, setIsStarred] = useState(false)
  const [activeView, setActiveView] = useState<BoardView>('kanban')

  const status =
    boards.isError || boardQuery.isError
      ? 'error'
      : boards.isSuccess && !boardId
        ? 'empty'
        : board
          ? 'ready'
          : 'loading'

  return {
    status,
    retry: () => void (boards.isError ? boards.refetch() : boardQuery.refetch()),
    columns,
    meta: {
      title: board?.title ?? '',
      setTitle: (title: string) => updateBoard.mutate({ title }),
      isStarred,
      toggleStar: () => setIsStarred((current) => !current),
      visibility: (board?.visibility ?? 'private') as Visibility,
      setVisibility: (visibility: Visibility) => updateBoard.mutate({ visibility }),
      activeView,
      setActiveView,
    },
    actions: {
      addColumn: (title: string, accent: ColumnAccent) => addColumn.mutate({ title, accent }),
      updateColumn: (columnId: string, title: string, accent: ColumnAccent) =>
        updateColumn.mutate({ columnId, title, accent }),
      deleteColumn: (columnId: string) => deleteColumn.mutate(columnId),
      reorderColumns: (sourceId: string, targetId: string) => {
        const ids = Object.keys(columns)
        const source = ids.indexOf(sourceId)
        const target = ids.indexOf(targetId)
        if (source === -1 || target === -1 || source === target) return
        // Húzás jobbra: a célt követő oszlop elé; balra: a cél elé.
        const beforeColumnId = source > target ? targetId : (ids[target + 1] ?? null)
        moveColumn.mutate({ columnId: sourceId, beforeColumnId })
      },
      saveTask: (task: SaveCardInput['task'], columnId: string, originalColumnId?: string) =>
        saveTask.mutate({ task, columnId, originalColumnId }),
      deleteTask: (_columnId: string, taskId: string) => deleteTask.mutate(taskId),
      moveTask: (
        taskId: string,
        _fromColumnId: string,
        toColumnId: string,
        targetTaskId: string | null = null,
      ) => moveTask.mutate({ taskId, toColumnId, targetTaskId }),
    },
  }
}

export type BoardMeta = ReturnType<typeof useBoardData>['meta']
