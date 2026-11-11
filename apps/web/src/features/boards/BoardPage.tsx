import { useMemo, useState } from 'react'
import { Board } from './Board'
import { BoardDialogs } from './BoardDialogs'
import { BoardHeader } from './BoardHeader'
import { BoardToolbar } from './BoardToolbar'
import { countTasks, filterColumns } from './filterColumns'
import { Topbar } from './Topbar'
import { COLUMN_ACCENTS, type Dialog } from './types'
import { useBoardDrag } from './useBoardDrag'
import { useBoardMeta } from './useBoardMeta'
import { useBoardState } from './useBoardState'

export function BoardPage() {
  const board = useBoardState()
  const meta = useBoardMeta()
  const [searchQuery, setSearchQuery] = useState('')
  const [dialog, setDialog] = useState<Dialog | null>(null)

  const drag = useBoardDrag({
    onMoveTask: board.moveTask,
    onReorderColumns: board.reorderColumns,
  })

  const visibleColumns = useMemo(
    () => filterColumns(board.columns, searchQuery),
    [board.columns, searchQuery],
  )
  const totalTasks = useMemo(() => countTasks(board.columns), [board.columns])

  const handleAddColumn = () => {
    const index = Object.keys(board.columns).length
    board.addColumn(
      `Új oszlop ${index + 1}`,
      COLUMN_ACCENTS[index % COLUMN_ACCENTS.length] ?? 'blue',
    )
  }

  const handleDeleteColumn = (columnId: string) => {
    if (Object.keys(board.columns).length <= 1) {
      window.alert('Legalább egy oszlopnak maradnia kell.')
      return
    }
    setDialog({ type: 'column-delete', columnId })
  }

  return (
    <div className="app-shell">
      <div className="trello-surface">
        <Topbar searchQuery={searchQuery} onSearchChange={setSearchQuery} totalTasks={totalTasks} />

        <div className="workspace-layout">
          <main className="board-page">
            <BoardHeader
              meta={meta}
              onInvite={() => setDialog({ type: 'invite' })}
              onAddColumn={handleAddColumn}
            />
            <BoardToolbar meta={meta} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
            <Board
              columns={visibleColumns}
              drag={drag}
              onRenameColumn={(columnId) => setDialog({ type: 'column-rename', columnId })}
              onDeleteColumn={handleDeleteColumn}
              onAddTask={(columnId) => setDialog({ type: 'card-create', columnId })}
              onEditTask={(columnId, task) => setDialog({ type: 'card-edit', columnId, task })}
              onDeleteTask={board.deleteTask}
            />
          </main>
        </div>
      </div>

      <BoardDialogs
        dialog={dialog}
        columns={board.columns}
        onClose={() => setDialog(null)}
        onSaveTask={board.saveTask}
        onUpdateColumn={board.updateColumn}
        onDeleteColumn={board.deleteColumn}
      />
    </div>
  )
}
