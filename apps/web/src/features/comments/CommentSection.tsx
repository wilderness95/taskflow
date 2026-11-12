import { extractMentionIds, type Mentionable } from '@taskflow/shared'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '../auth/useSession'
import { CommentItem } from './CommentItem'
import { MentionTextarea } from './MentionTextarea'
import { useComments } from './useComments'
import './CommentSection.css'

type CommentSectionProps = {
  boardId: string
  cardId: string
  people: Mentionable[]
  /** `board:write`: hozzászólhat. */
  canComment: boolean
  /** `board:update`: mások hozzászólását is törölheti. */
  isBoardAdmin: boolean
}

/** A kártya hozzászólás-szála és a beküldő mező. */
export function CommentSection({
  boardId,
  cardId,
  people,
  canComment,
  isBoardAdmin,
}: CommentSectionProps) {
  const { t } = useTranslation('comment')
  const me = useCurrentUser()
  const { comments, add, edit, remove } = useComments(boardId, cardId)
  const [body, setBody] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const text = body.trim()
    if (!text) return
    add.mutate({ body: text, mentionIds: extractMentionIds(text, people) })
    setBody('')
  }

  const items = comments.data ?? []

  return (
    <section className="comment-section" aria-label={t('title')}>
      <h3>{t('title')}</h3>
      {comments.isError && <p role="alert">{t('loadError')}</p>}
      {comments.isSuccess && items.length === 0 && <p className="comment-empty">{t('empty')}</p>}
      <ul className="comment-list">
        {items.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            people={people}
            canEdit={canComment && comment.authorId === me?.id}
            canDelete={canComment && (comment.authorId === me?.id || isBoardAdmin)}
            onSave={(text, mentionIds) => edit.mutate({ id: comment.id, body: text, mentionIds })}
            onDelete={() => {
              if (window.confirm(t('deleteConfirm'))) remove.mutate(comment.id)
            }}
          />
        ))}
      </ul>
      {canComment && (
        <form className="comment-form" onSubmit={submit}>
          <MentionTextarea
            value={body}
            onChange={setBody}
            people={people}
            placeholder={t('placeholder')}
            ariaLabel={t('newAria')}
          />
          <button type="submit" className="primary-button" disabled={!body.trim() || add.isPending}>
            {t('send')}
          </button>
        </form>
      )}
    </section>
  )
}
