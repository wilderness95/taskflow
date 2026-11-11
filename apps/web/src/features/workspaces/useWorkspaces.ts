import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { BoardSummaryDto, CreateBoardRequest, WorkspaceDto } from '@taskflow/shared'
import * as boardsApi from '../../api/boards'
import * as api from '../../api/workspaces'

export const workspacesKey = ['workspaces'] as const
export const workspaceBoardsKey = (workspaceId: string) =>
  ['boards', 'workspace', workspaceId] as const

export function useWorkspaces() {
  return useQuery({ queryKey: workspacesKey, queryFn: api.listWorkspaces })
}

/** A route-ban szereplő (vagy ennek hiányában az első) munkaterület. */
export function useWorkspace(workspaceId: string | undefined): WorkspaceDto | undefined {
  const { data } = useWorkspaces()
  return data?.find((workspace) => workspace.id === workspaceId)
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { handlesErrors: true },
    mutationFn: (name: string) => api.createWorkspace({ name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspacesKey }),
  })
}

export function useWorkspaceBoards(workspaceId: string) {
  return useQuery({
    queryKey: workspaceBoardsKey(workspaceId),
    queryFn: () => boardsApi.listBoards(workspaceId),
  })
}

export function useCreateBoard(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    meta: { handlesErrors: true },
    mutationFn: (input: CreateBoardRequest) => boardsApi.createBoard(workspaceId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workspaceBoardsKey(workspaceId) }),
  })
}

/** Csillagozás optimistán: a lista azonnal frissül, hibánál visszaáll. */
export function useToggleStar(workspaceId: string) {
  const queryClient = useQueryClient()
  const key = workspaceBoardsKey(workspaceId)
  return useMutation({
    mutationFn: (board: BoardSummaryDto) =>
      board.starred ? boardsApi.unstarBoard(board.id) : boardsApi.starBoard(board.id),
    onMutate: async (board) => {
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<BoardSummaryDto[]>(key)
      queryClient.setQueryData<BoardSummaryDto[]>(key, (boards) =>
        boards?.map((item) => (item.id === board.id ? { ...item, starred: !board.starred } : item)),
      )
      return { previous }
    },
    onError: (_error, _board, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: key }),
  })
}
