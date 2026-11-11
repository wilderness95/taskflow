import { useTranslation } from 'react-i18next'
import { ColumnView } from '../columns/ColumnView'
import type { BoardDrag } from './useBoardDrag'
import type { Columns, Task } from './types'
import './Board.css'

type BoardProps = {
  columns: Columns
  drag: BoardDrag
  onRenameColumn: (columnId: string) => void
  onDeleteColumn: (columnId: string) => void
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
          onAddTask={() => onAddTask(columnId)}
          onEditTask={(task) => onEditTask(columnId, task)}
          onDeleteTask={(taskId) => onDeleteTask(columnId, taskId)}
          readOnly={readOnly}
        />
      ))}
    </section>
  )
}
