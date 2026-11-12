import { useTranslation } from 'react-i18next'
import { classNames } from '../../shared/lib/classNames'
import { directionFromKey, type MoveDirection } from '../boards/keyboardMove'
import type { BoardDrag } from '../boards/useBoardDrag'
import type { Column, Task } from '../boards/types'
import { TaskCard } from '../cards/TaskCard'
import './ColumnView.css'

type ColumnViewProps = {
  columnId: string
  column: Column
  drag: BoardDrag
  onRename: () => void
  onDelete: () => void
  onArchive: () => void
  onArchiveTask: (taskId: string) => void
  onKeyboardMoveTask: (taskId: string, direction: MoveDirection) => void
  onKeyboardMoveColumn: (direction: 'left' | 'right') => void
  onAddTask: () => void
  onEditTask: (task: Task) => void
  onDeleteTask: (taskId: string) => void
  readOnly?: boolean
}

export function ColumnView({
  columnId,
  column,
  drag,
  onRename,
  onDelete,
  onArchive,
  onArchiveTask,
  onKeyboardMoveTask,
  onKeyboardMoveColumn,
  onAddTask,
  onEditTask,
  onDeleteTask,
  readOnly = false,
}: ColumnViewProps) {
  const { t } = useTranslation('column')
  const { taskDrag, columnDrag } = drag
  const isTaskTarget = taskDrag.targetColumnId === columnId
  const isBeingDragged = columnDrag.activeColumnId === columnId
  const isColumnTarget = columnDrag.targetColumnId === columnId && !isBeingDragged

  return (
    <div
      className={classNames(
        'column',
        column.accent,
        isTaskTarget && 'is-drop-target',
        isBeingDragged && 'is-column-dragging',
        isColumnTarget && 'is-column-drop-target',
      )}
      {...drag.getColumnProps(columnId)}
    >
      <header
        className="column-header"
        data-column-id={columnId}
        tabIndex={readOnly ? undefined : 0}
        aria-keyshortcuts={readOnly ? undefined : 'Alt+ArrowLeft Alt+ArrowRight'}
        onKeyDown={(event) => {
          if (readOnly || event.target !== event.currentTarget || !event.altKey) return
          const direction = directionFromKey(event.key)
          if (direction === 'left' || direction === 'right') {
            event.preventDefault()
            onKeyboardMoveColumn(direction)
          }
        }}
      >
        <div className="column-title-wrap">
          <span className="column-dot" aria-hidden="true" />
          <h2>{column.title}</h2>
        </div>

        {!readOnly && (
          <div className="column-tools">
            <button
              type="button"
              className="column-action"
              aria-label={t('renameAria', { title: column.title })}
              onClick={onRename}
            >
              ✎
            </button>
            <button
              type="button"
              className="column-action"
              aria-label={t('archiveAria', { title: column.title })}
              onClick={onArchive}
            >
              🗄
            </button>
            <button
              type="button"
              className="column-action danger"
              aria-label={t('deleteAria', { title: column.title })}
              onClick={onDelete}
            >
              🗑
            </button>
          </div>
        )}
      </header>

      <div className="task-list">
        {column.tasks.length === 0 ? (
          readOnly ? (
            <p className="empty-state">{t('emptyReadOnly')}</p>
          ) : (
            <button
              type="button"
              className={classNames('empty-state', isTaskTarget && 'is-drop-target')}
              onClick={onAddTask}
              {...drag.getEmptyColumnProps(columnId)}
            >
              {t('addCard')}
            </button>
          )
        ) : (
          <>
            {column.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                dragProps={drag.getTaskProps(columnId, task.id)}
                isDragging={taskDrag.activeTaskId === task.id}
                isDropTarget={taskDrag.targetTaskId === task.id}
                onEdit={() => onEditTask(task)}
                onDelete={() => onDeleteTask(task.id)}
                onArchive={() => onArchiveTask(task.id)}
                onKeyboardMove={(direction) => onKeyboardMoveTask(task.id, direction)}
                readOnly={readOnly}
              />
            ))}

            {!readOnly && (
              <button type="button" className="add-card" onClick={onAddTask}>
                {t('addCard')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
