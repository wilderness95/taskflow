import { getChecklistsProgress, getDueDateState } from '@taskflow/shared'
import { useTranslation } from 'react-i18next'
import { formatShortDate } from '../../i18n/format'
import { classNames } from '../../shared/lib/classNames'
import { Icon } from '../../shared/ui/Icon'
import { attachmentFileUrl } from '../../api/attachments'
import { AssigneeStack } from './AssigneeStack'
import type { DragProps } from '../boards/useBoardDrag'
import { directionFromKey, type MoveDirection } from '../boards/keyboardMove'
import type { Task } from '../boards/types'
import '../../shared/styles/buttons.css'
import '../../shared/styles/tags.css'
import './TaskCard.css'

type TaskCardProps = {
  task: Task
  dragProps: DragProps
  isDragging: boolean
  isDropTarget: boolean
  onEdit: () => void
  onDelete: () => void
  onArchive: () => void
  /** Alt + nyíl: a kártya áthelyezése billentyűzettel. */
  onKeyboardMove: (direction: MoveDirection) => void
  /** Olvasási jog: nincs szerkesztés és törlés. */
  readOnly?: boolean
}

export function TaskCard({
  task,
  dragProps,
  isDragging,
  isDropTarget,
  onEdit,
  onDelete,
  onArchive,
  onKeyboardMove,
  readOnly = false,
}: TaskCardProps) {
  const { t } = useTranslation('card')
  const checklistProgress = getChecklistsProgress(task.checklists)
  const dueState = getDueDateState(task.dueDate)

  return (
    <article
      className={classNames(
        'task-card',
        isDragging && 'is-dragging',
        isDropTarget && 'is-over-target',
      )}
      data-task-id={task.id}
      tabIndex={0}
      aria-keyshortcuts={
        readOnly ? undefined : 'Enter Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight'
      }
      onDoubleClick={readOnly ? undefined : onEdit}
      onKeyDown={(event) => {
        // A kártyán belüli gombok saját billentyűzet-kezelését nem írjuk felül.
        if (readOnly || event.target !== event.currentTarget) return
        const direction = event.altKey ? directionFromKey(event.key) : null
        if (direction) {
          event.preventDefault()
          event.stopPropagation()
          onKeyboardMove(direction)
        } else if (event.key === 'Enter') {
          event.preventDefault()
          onEdit()
        }
      }}
      {...dragProps}
    >
      {isDropTarget && <div className="insert-indicator" aria-hidden="true" />}

      {task.coverAttachmentId && (
        <img
          className="task-card-cover"
          src={attachmentFileUrl(task.coverAttachmentId)}
          alt=""
          loading="lazy"
        />
      )}

      <div className="task-card-top">
        <span className={`priority-pill priority-${task.priority}`}>
          {t(`priority.${task.priority}`)}
        </span>
        {!readOnly && (
          <div className="task-card-tools">
            <button
              type="button"
              className="archive-button"
              aria-label={t('archiveAria', { title: task.title })}
              onClick={(event) => {
                event.stopPropagation()
                onArchive()
              }}
            >
              <Icon name="archive" size={15} />
            </button>
            <button
              type="button"
              className="delete-button"
              aria-label={t('deleteAria', { title: task.title })}
              onClick={(event) => {
                event.stopPropagation()
                onDelete()
              }}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        )}
      </div>

      <h3>{task.title}</h3>

      {task.tags.length > 0 && (
        <div className="task-tags">
          {task.tags.slice(0, 3).map((tag) => (
            <span key={`${task.id}-${tag.label}`} className={`task-tag tag-${tag.color}`}>
              {tag.label}
            </span>
          ))}
        </div>
      )}

      <p>{task.description || t('noDescription')}</p>

      {task.dueDate && (
        <div className={`task-due ${dueState}`}>
          <span className="task-due-label">{t('dueLabel')}</span>
          <strong>{formatShortDate(task.dueDate)}</strong>
        </div>
      )}

      {task.attachmentCount > 0 && (
        <div
          className="task-attachments"
          role="img"
          aria-label={t('attachments.count', { count: task.attachmentCount })}
        >
          <Icon name="paperclip" size={14} />
          <span>{task.attachmentCount}</span>
        </div>
      )}

      <AssigneeStack assignees={task.assignees} />

      {checklistProgress.total > 0 && (
        <>
          <div className="task-checklist-summary">
            <div className="task-checklist-status">
              <span className="checklist-toggle">
                <Icon name="check" size={12} />
              </span>
              <span>
                {checklistProgress.done}/{checklistProgress.total}
              </span>
            </div>
            <div className="task-progress-pill">{checklistProgress.percent}%</div>
          </div>

          <div className="task-checklist-track-wrap">
            <div className="checklist-track">
              <span className="checklist-fill" style={{ width: `${checklistProgress.percent}%` }} />
            </div>
          </div>
        </>
      )}
    </article>
  )
}
