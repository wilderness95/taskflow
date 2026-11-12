import { useTranslation } from 'react-i18next'
import { ColumnView } from '../columns/ColumnView'
import type { MoveDirection } from './keyboardMove'
import type { BoardDrag } from './useBoardDrag'
import type { Columns, Task } from './types'
import './Board.css'

type BoardProps = {
  columns: Columns
  drag: BoardDrag
  onRenameColumn: (columnId: string) => void
  onDeleteColumn: (columnId: string) => void
  onArchiveColumn: (columnId: string) => void
  onArchiveTask: (taskId: string) => void
  onKeyboardMoveTask: (columnId: string, taskId: string, direction: MoveDirection) => void
  onKeyboardMoveColumn: (columnId: string, direction: 'left' | 'right') => void
  onAddTask: (columnId: string) => void
  onEditTask: (columnId: string, task: Task) => void
  onDeleteTask: (columnId: string, taskId: string) => void
  readOnly?: boolean
}

export function Board({
  columns,
  drag,
  onRenameColumn,
  onDeleteColumn,
  onArchiveColumn,
  onArchiveTask,
  onKeyboardMoveTask,
  onKeyboardMoveColumn,
  onAddTask,
  onEditTask,
  onDeleteTask,
  readOnly = false,
}: BoardProps) {
  const { t } = useTranslation('board')

  return (
    <section className="board" aria-label={t('boardAria')}>
      {Object.entries(columns).map(([columnId, column]) => (
        <ColumnView
          key={columnId}
          columnId={columnId}
          column={column}
          drag={drag}
          onRename={() => onRenameColumn(columnId)}
          onDelete={() => onDeleteColumn(columnId)}
          onArchive={() => onArchiveColumn(columnId)}
          onArchiveTask={onArchiveTask}
          onKeyboardMoveTask={(taskId, direction) =>
            onKeyboardMoveTask(columnId, taskId, direction)
          }
          onKeyboardMoveColumn={(direction) => onKeyboardMoveColumn(columnId, direction)}
          onAddTask={() => onAddTask(columnId)}
          onEditTask={(task) => onEditTask(columnId, task)}
          onDeleteTask={(taskId) => onDeleteTask(columnId, taskId)}
          readOnly={readOnly}
        />
      ))}
    </section>
  )
}
