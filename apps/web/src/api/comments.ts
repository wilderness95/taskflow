import {
  commentListSchema,
  commentSchema,
  type CommentDto,
  type CreateCommentRequest,
  type UpdateCommentInput,
} from '@taskflow/shared'
import { apiFetch } from './client'

/** Az összes hozzászólás (a lapozást végigjárja; egy kártyán ritkán van sok). */
export async function listComments(cardId: string): Promise<CommentDto[]> {
  const all: CommentDto[] = []
  let cursor: string | null = null
  do {
    const page = commentListSchema.parse(
      await apiFetch(
        'GET',
        `/cards/${cardId}/comments?limit=200${cursor ? `&cursor=${cursor}` : ''}`,
      ),
    )
    all.push(...page.data)
    cursor = page.nextCursor
  } while (cursor)
  return all
}

export const createComment = async (
  cardId: string,
  input: CreateCommentRequest,
): Promise<CommentDto> =>
  commentSchema.parse(await apiFetch('POST', `/cards/${cardId}/comments`, input))

export const updateComment = async (id: string, input: UpdateCommentInput): Promise<CommentDto> =>
  commentSchema.parse(await apiFetch('PATCH', `/comments/${id}`, input))

export const deleteComment = (id: string) => apiFetch('DELETE', `/comments/${id}`)
