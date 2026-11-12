import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateListItemRequest, ListDetailDto, UpdateListItemInput } from '@taskflow/shared'
import * as api from '../../api/lists'
import { patchListItem } from './listCache'
import type { ItemMoveTarget } from './listMoves'
import { LISTS_KEY, listKey } from './useLists'

/**
 * Egy lista írási műveletei. A kipipálás és a szövegszerkesztés optimista (azonnal látszik,
 * hiba esetén visszaáll); a többi művelet után a szerver állapotát olvassuk újra.
 */
export function useListMutations(listId: string) {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: LISTS_KEY })

  const updateItem = useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateListItemInput }) =>
      api.updateItem(id, input),
    onMutate: async ({ id, input }) => {
      await queryClient.cancelQueries({ queryKey: listKey(listId) })
      const previous = queryClient.getQueryData<ListDetailDto>(listKey(listId))
      const { version: _version, ...patch } = input
      if (previous) queryClient.setQueryData(listKey(listId), patchListItem(previous, id, patch))
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(listKey(listId), context.previous)
    },
    onSettled: refresh,
  })

  const useRefreshing = <V>(fn: (variables: V) => Promise<unknown>) =>
    useMutation({ mutationFn: fn, onSuccess: refresh })

  return {
    updateItem,
    createItem: useRefreshing((input: CreateListItemRequest) => api.createItem(listId, input)),
    moveItem: useRefreshing(({ id, target }: { id: string; target: ItemMoveTarget }) =>
      api.moveItem(id, target),
    ),
    deleteItem: useRefreshing((id: string) => api.deleteItem(id)),
    createSection: useRefreshing((title: string) => api.createSection(listId, title)),
    renameSection: useRefreshing(({ id, title }: { id: string; title: string }) =>
      api.renameSection(id, title),
    ),
    deleteSection: useRefreshing((id: string) => api.deleteSection(id)),
    rename: useRefreshing((title: string) => api.renameList(listId, title)),
    archive: useRefreshing(() => api.archiveList(listId)),
    clearDone: useRefreshing(() => api.clearDone(listId)),
    resetRecurring: useRefreshing(() => api.resetRecurring(listId)),
  }
}
export type ListMutations = ReturnType<typeof useListMutations>
