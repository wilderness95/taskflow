import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../../api/comments'

/** A kártya hozzászólásai; a kulcs a tábla kulcsa alatt él, így a tábla-események frissítik is. */
export const commentsKey = (boardId: string, cardId: string) =>
  ['board', boardId, 'comments', cardId] as const

export function useComments(boardId: string, cardId: string) {
  const queryClient = useQueryClient()
  const key = commentsKey(boardId, cardId)
  const refresh = () => queryClient.invalidateQueries({ queryKey: key })

  const comments = useQuery({ queryKey: key, queryFn: () => api.listComments(cardId) })
  const add = useMutation({
    mutationFn: (input: { body: string; mentionIds: string[] }) => api.createComment(cardId, input),
    onSuccess: refresh,
  })
  const edit = useMutation({
    mutationFn: (vars: { id: string; body: string; mentionIds: string[] }) =>
      api.updateComment(vars.id, { body: vars.body, mentionIds: vars.mentionIds }),
    onSuccess: refresh,
  })
  const remove = useMutation({ mutationFn: api.deleteComment, onSuccess: refresh })

  return { comments, add, edit, remove }
}
