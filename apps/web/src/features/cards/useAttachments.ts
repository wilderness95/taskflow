import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as boardsApi from '../../api/boards'
import * as api from '../../api/attachments'

/** A kártya csatolmányai; a kulcs a tábla kulcsa alatt él, így a tábla-események frissítik is. */
export const attachmentsKey = (boardId: string, cardId: string) =>
  ['board', boardId, 'attachments', cardId] as const

export function useAttachments(boardId: string, cardId: string) {
  const queryClient = useQueryClient()
  const key = attachmentsKey(boardId, cardId)
  // A csatolmány-változás a kártyán (darabszám, borító) is látszik: a tábla is újratöltődik.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: key }),
      queryClient.invalidateQueries({ queryKey: ['board', boardId], exact: true }),
    ])

  // A borító a tábla gyorsítótárából jön, így a módosítás után azonnal frissül.
  const cover = useQuery({
    queryKey: ['board', boardId],
    queryFn: () => boardsApi.getBoard(boardId),
    select: (board) =>
      board.columns.flatMap((column) => column.cards).find((card) => card.id === cardId)
        ?.coverAttachmentId ?? undefined,
  })
  const list = useQuery({ queryKey: key, queryFn: () => api.listAttachments(cardId) })
  const upload = useMutation({
    meta: { handlesErrors: true },
    mutationFn: (file: File) => api.uploadAttachment(cardId, file),
    onSettled: refresh,
  })
  const remove = useMutation({ mutationFn: api.deleteAttachment, onSettled: refresh })
  const setCover = useMutation({
    mutationFn: (attachmentId: string | null) =>
      boardsApi.updateCard(cardId, { coverAttachmentId: attachmentId }),
    onSettled: refresh,
  })
  return { list, coverAttachmentId: cover.data, upload, remove, setCover }
}
