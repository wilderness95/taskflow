import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UpdateLabelInput } from '@taskflow/shared'
import * as api from '../../api/boards'

/** A tábla címkéi (a tábla gyorsítótárából) és a kezelésük; minden írás után a tábla újratöltődik. */
export function useLabels(boardId: string) {
  const queryClient = useQueryClient()
  const key = ['board', boardId] as const
  const query = useQuery({
    queryKey: key,
    queryFn: () => api.getBoard(boardId),
    select: (b) => b.labels,
  })
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })

  const update = useMutation({
    meta: { handlesErrors: true },
    mutationFn: ({ id, input }: { id: string; input: UpdateLabelInput }) =>
      api.updateLabel(id, input),
    onSettled: refresh,
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.deleteLabel(id),
    onSettled: refresh,
  })
  return { query, update, remove }
}
