import { getChecklistProgress, getDueDateState } from '@taskflow/shared'
import { useTranslation } from 'react-i18next'
import { formatShortDate } from '../../i18n/format'
import { classNames } from '../../shared/lib/classNames'
import { AssigneeStack } from './AssigneeStack'
import type { DragProps } from '../boards/useBoardDrag'
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
  readOnly = false,
}: TaskCardProps) {
  const { t } = useTranslation('card')
  const checklistProgress = getChecklistProgress(task.checklist)
  const dueState = getDueDateState(task.dueDate)

  return (
    <article
      className={classNames(
        'task-card',
        isDragging && 'is-dragging',
        isDropTarget && 'is-over-target',
      )}
      onDoubleClick={readOnly ? undefined : onEdit}
      {...dragProps}
    >
      {isDropTarget && <div className="insert-indicator" aria-hidden="true" />}

      <div className="task-card-top">
        <span className={`priority-pill priority-${task.priority}`}>
          {t(`priority.${task.priority}`)}
        </span>
        {!readOnly && (
          <button
            type="button"
            className="delete-button"
            aria-label={t('deleteAria', { title: task.title })}
            onClick={(event) => {
              event.stopPropagation()
              onDelete()
            }}
          >
            ×
          </button>
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

      <AssigneeStack assignees={task.assignees} />

      {checklistProgress.total > 0 && (
        <>
          <div className="task-checklist-summary">
            <div className="task-checklist-status">
              <span className="checklist-toggle">✓</span>
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
