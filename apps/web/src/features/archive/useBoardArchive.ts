import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../../api/boards'

const archiveKey = (boardId: string) => ['board', boardId, 'archive'] as const

/** A tábla archivált kártyái és oszlopai, valamint a visszaállításuk. */
export function useBoardArchive(boardId: string) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: archiveKey(boardId),
    queryFn: () => api.getBoardArchive(boardId),
  })

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: archiveKey(boardId) }),
      queryClient.invalidateQueries({ queryKey: ['board', boardId], exact: true }),
    ])

  const restoreCard = useMutation({
    mutationFn: (cardId: string) => api.restoreCard(cardId),
    onSettled: refresh,
  })
  const restoreColumn = useMutation({
    mutationFn: (columnId: string) => api.restoreColumn(columnId),
    onSettled: refresh,
  })

  return { query, restoreCard, restoreColumn }
}
