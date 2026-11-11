import { getChecklistProgress, getDueDateState } from '@taskflow/shared'
import { classNames } from '../../shared/lib/classNames'
import type { DragProps } from '../boards/useBoardDrag'
import type { Task } from '../boards/types'
import { formatDueDate } from './formatDueDate'
import { priorityLabels } from './priorityLabels'

type TaskCardProps = {
  task: Task
  dragProps: DragProps
  isDragging: boolean
  isDropTarget: boolean
  onEdit: () => void
  onDelete: () => void
}

export function TaskCard({
  task,
  dragProps,
  isDragging,
  isDropTarget,
  onEdit,
  onDelete,
}: TaskCardProps) {
  const checklistProgress = getChecklistProgress(task.checklist)
  const dueState = getDueDateState(task.dueDate)

  return (
    <article
      className={classNames(
        'task-card',
        isDragging && 'is-dragging',
        isDropTarget && 'is-over-target',
      )}
      onDoubleClick={onEdit}
      {...dragProps}
    >
      {isDropTarget && <div className="insert-indicator" aria-hidden="true" />}

      <div className="task-card-top">
        <span className={`priority-pill priority-${task.priority}`}>
          {priorityLabels[task.priority]}
        </span>
        <button
          type="button"
          className="delete-button"
          aria-label={`Töröld a ${task.title} feladatot`}
          onClick={(event) => {
            event.stopPropagation()
            onDelete()
          }}
        >
          ×
        </button>
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

      <p>{task.description}</p>

      {task.dueDate && (
        <div className={`task-due ${dueState}`}>
          <span className="task-due-label">Határidő</span>
          <strong>{formatDueDate(task.dueDate)}</strong>
        </div>
      )}

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
