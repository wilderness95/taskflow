import {
  extractMentionIds,
  splitMentions,
  type CommentDto,
  type Mentionable,
} from '@taskflow/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDateTime } from '../../i18n/format'
import { Avatar } from '../auth/Avatar'
import { MentionTextarea } from './MentionTextarea'
import './CommentItem.css'

type CommentItemProps = {
  comment: CommentDto
  people: Mentionable[]
  /** A szerző szerkeszthet. */
  canEdit: boolean
  /** A szerző vagy a tábla adminja törölhet. */
  canDelete: boolean
  onSave: (body: string, mentionIds: string[]) => void
  onDelete: () => void
}

export function CommentItem({
  comment,
  people,
  canEdit,
  canDelete,
  onSave,
  onDelete,
}: CommentItemProps) {
  const { t } = useTranslation(['comment', 'common'])
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(comment.body)

  const save = () => {
    const body = draft.trim()
    if (!body) return
    onSave(body, extractMentionIds(body, people))
    setEditing(false)
  }

  return (
    <li className="comment-item">
      <Avatar user={{ name: comment.authorName, avatarUrl: comment.authorAvatarUrl }} />
      <div className="comment-main">
        <div className="comment-meta">
          <strong>{comment.authorName}</strong>
          {comment.viaApiKey && <span className="comment-badge">{t('comment:viaApiKey')}</span>}
          <time dateTime={comment.createdAt}>{formatDateTime(comment.createdAt)}</time>
          {comment.editedAt && <span>{t('comment:edited')}</span>}
        </div>

        {editing ? (
          <>
            <MentionTextarea
              value={draft}
              onChange={setDraft}
              people={people}
              ariaLabel={t('comment:editAria')}
            />
            <div className="comment-actions">
              <button type="button" className="primary-button" onClick={save}>
                {t('common:save')}
              </button>
              <button type="button" className="secondary-button" onClick={() => setEditing(false)}>
                {t('common:cancel')}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="comment-body">
              {splitMentions(comment.body, people).map((segment, index) =>
                segment.mention ? (
                  <span key={index} className="comment-mention">
                    {segment.text}
                  </span>
                ) : (
                  segment.text
                ),
              )}
            </p>
            {(canEdit || canDelete) && (
              <div className="comment-actions">
                {canEdit && (
                  <button
                    type="button"
                    className="comment-link"
                    onClick={() => {
                      setDraft(comment.body)
                      setEditing(true)
                    }}
                  >
                    {t('comment:edit')}
                  </button>
                )}
                {canDelete && (
                  <button type="button" className="comment-link" onClick={onDelete}>
                    {t('comment:delete')}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </li>
  )
}
