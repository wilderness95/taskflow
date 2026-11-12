import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { BoardFilter } from '@taskflow/shared'
import * as api from '../../api/filters'

/** A felhasználó mentett szűrői a táblán (személyesek, a táblakulcs alatt tárolva). */
export function useSavedFilters(boardId: string) {
  const queryClient = useQueryClient()
  const key = ['board', boardId, 'filters'] as const
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })

  const list = useQuery({ queryKey: key, queryFn: () => api.listSavedFilters(boardId) })
  const save = useMutation({
    meta: { handlesErrors: true },
    mutationFn: ({ name, filter }: { name: string; filter: BoardFilter }) =>
      api.createSavedFilter(boardId, { name, filter }),
    onSuccess: refresh,
  })
  const remove = useMutation({ mutationFn: api.deleteSavedFilter, onSuccess: refresh })
  return { list, save, remove }
}
