import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../../api/lists'

/** Minden listás lekérdezés közös előtagja (a mutációk ezt érvénytelenítik). */
export const LISTS_KEY = ['lists'] as const
export const workspaceListsKey = (workspaceId: string) =>
  ['lists', 'workspace', workspaceId] as const
export const archivedListsKey = (workspaceId: string) =>
  ['lists', 'workspace', workspaceId, 'archived'] as const
export const listKey = (listId: string) => ['lists', 'detail', listId] as const

export function useWorkspaceLists(workspaceId: string) {
  return useQuery({
    queryKey: workspaceListsKey(workspaceId),
    queryFn: () => api.listLists(workspaceId),
  })
}

export function useList(listId: string) {
  return useQuery({ queryKey: listKey(listId), queryFn: () => api.getList(listId), retry: false })
}

/** Az archivált listák és a visszaállítás. */
export function useArchivedLists(workspaceId: string) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: archivedListsKey(workspaceId),
    queryFn: () => api.listLists(workspaceId, true),
  })
  const restore = useMutation({
    mutationFn: (listId: string) => api.restoreList(listId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LISTS_KEY }),
  })
  return { query, restore }
}

export function useCreateList(workspaceId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (title: string) => api.createList(workspaceId, title),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: LISTS_KEY }),
  })
}
