import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { boardRoleCan, type BoardDto } from '@taskflow/shared'
import { useMemo, useState } from 'react'
import * as api from '../../api/boards'
import { ApiError } from '../../api/client'
import { saveCard, type SaveCardInput } from '../cards/saveCard'
import { moveCardInBoard, moveColumnInBoard } from './boardCache'
import { toColumns } from './boardMapper'
import type { BoardView, ColumnAccent, Visibility } from './types'

const boardKey = (boardId: string) => ['board', boardId] as const

/** Egy tábla adatai és műveletei; a tábla azonosítóját az útvonal adja. */
export function useBoardData(boardId: string) {
  const queryClient = useQueryClient()

  const boardQuery = useQuery({
    queryKey: boardKey(boardId),
    queryFn: () => api.getBoard(boardId),
    // Hiányzó vagy nem olvasható tábla (404) esetén felesleges az újrapróbálkozás.
    retry: (count, error) => !(error instanceof ApiError && error.status === 404) && count < 1,
  })
  const board = boardQuery.data

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['boards'] })
    return queryClient.invalidateQueries({ queryKey: boardKey(boardId) })
  }
  // Minden írás után a szerver állapota az igazság.
  const useWrite = <TVars>(fn: (vars: TVars) => Promise<unknown>) =>
    useMutation({ mutationFn: fn, onSettled: refresh })

  /** Optimista írás: a gyorsítótár azonnal frissül, hibánál visszaáll, végül a szerver állapota az igazság. */
  const useOptimisticWrite = <TVars>(
    fn: (vars: TVars) => Promise<unknown>,
    apply: (current: BoardDto, vars: TVars) => BoardDto,
  ) =>
    useMutation({
      mutationFn: fn,
      onMutate: async (vars: TVars) => {
        const key = boardKey(boardId)
        await queryClient.cancelQueries({ queryKey: key })
        const previous = queryClient.getQueryData<BoardDto>(key)
        if (previous) {
          queryClient.setQueryData(key, apply(previous, vars))
        }
        return { previous }
      },
      onError: (_error, _vars, context) => {
        if (context?.previous) {
          queryClient.setQueryData(boardKey(boardId), context.previous)
        }
      },
      onSettled: refresh,
    })

  const addColumn = useWrite(({ title, accent }: { title: string; accent: ColumnAccent }) =>
    api.createColumn(boardId, { title, accent }),
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
  const moveColumn = useOptimisticWrite(
    ({ columnId, beforeColumnId }: { columnId: string; beforeColumnId: string | null }) =>
      api.moveColumn(columnId, { beforeColumnId }),
    (current, { columnId, beforeColumnId }) => moveColumnInBoard(current, columnId, beforeColumnId),
  )
  const saveTask = useWrite((input: SaveCardInput) => saveCard(board as BoardDto, input))
  const deleteTask = useWrite((taskId: string) => api.deleteCard(taskId))
  const moveTask = useOptimisticWrite(
    ({
      taskId,
      toColumnId,
      targetTaskId,
    }: {
      taskId: string
      toColumnId: string
      targetTaskId: string | null
    }) => api.moveCard(taskId, { columnId: toColumnId, beforeCardId: targetTaskId }),
    (current, { taskId, toColumnId, targetTaskId }) =>
      moveCardInBoard(current, taskId, toColumnId, targetTaskId),
  )
  const updateBoard = useWrite((input: { title?: string; visibility?: Visibility }) =>
    api.updateBoard(boardId, input),
  )

  const columns = useMemo(() => (board ? toColumns(board) : {}), [board])

  // A nézetválasztó egyelőre kliensoldali állapot.
  const [activeView, setActiveView] = useState<BoardView>('kanban')

  // A csillag személyes; optimistán frissül, hibánál visszaáll.
  const toggleStar = useOptimisticWrite(
    (starred: boolean) => (starred ? api.unstarBoard(boardId) : api.starBoard(boardId)),
    (current, starred) => ({ ...current, starred: !starred }),
  )

  const myRole = board?.myRole ?? null
  const permissions = {
    write: boardRoleCan(myRole, 'board:write'),
    update: boardRoleCan(myRole, 'board:update'),
    manageMembers: boardRoleCan(myRole, 'board:manage_members'),
  }

  const status: 'loading' | 'error' | 'notFound' | 'ready' = boardQuery.isError
    ? boardQuery.error instanceof ApiError && boardQuery.error.status === 404
      ? 'notFound'
      : 'error'
    : board
      ? 'ready'
      : 'loading'

  return {
    status,
    retry: () => void boardQuery.refetch(),
    workspaceId: board?.workspaceId,
    columns,
    meta: {
      title: board?.title ?? '',
      setTitle: (title: string) => updateBoard.mutate({ title }),
      isStarred: board?.starred ?? false,
      toggleStar: () => toggleStar.mutate(board?.starred ?? false),
      permissions,
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
