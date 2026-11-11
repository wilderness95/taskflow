import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Board } from './Board'
import { BoardDialogs } from './BoardDialogs'
import { BoardHeader } from './BoardHeader'
import { BoardToolbar } from './BoardToolbar'
import { countTasks, filterColumns } from './filterColumns'
import { Topbar } from './Topbar'
import { COLUMN_ACCENTS, type Dialog } from './types'
import { useBoardDrag } from './useBoardDrag'
import { useBoardData } from './useBoardData'
import './BoardPage.css'

export function BoardPage() {
  const { t } = useTranslation(['card', 'column', 'board'])
  const { status, retry, columns, meta, actions } = useBoardData()
  const [searchQuery, setSearchQuery] = useState('')
  const [dialog, setDialog] = useState<Dialog | null>(null)

  const drag = useBoardDrag({
    onMoveTask: actions.moveTask,
    onReorderColumns: actions.reorderColumns,
  })

  const visibleColumns = useMemo(
    () => filterColumns(columns, searchQuery, (priority) => t(`card:priority.${priority}`)),
    [columns, searchQuery, t],
  )
  const totalTasks = useMemo(() => countTasks(columns), [columns])

  const handleAddColumn = () => {
    const index = Object.keys(columns).length
    actions.addColumn(
      t('column:defaultTitle', { number: index + 1 }),
      COLUMN_ACCENTS[index % COLUMN_ACCENTS.length] ?? 'blue',
    )
  }

  const handleDeleteColumn = (columnId: string) => {
    if (Object.keys(columns).length <= 1) {
      window.alert(t('column:minOneColumn'))
      return
    }
    setDialog({ type: 'column-delete', columnId })
  }

  if (status !== 'ready') {
    return (
      <div className="app-shell">
        <p className="board-status" role={status === 'error' ? 'alert' : 'status'}>
          {t(
            `board:${status === 'loading' ? 'loading' : status === 'empty' ? 'empty' : 'loadError'}`,
          )}
        </p>
        {status === 'error' && (
          <button type="button" className="secondary-button" onClick={retry}>
            {t('board:retry')}
          </button>
        )}
      </div>
    )
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
              onDeleteTask={actions.deleteTask}
            />
          </main>
        </div>
      </div>

      <BoardDialogs
        dialog={dialog}
        columns={columns}
        onClose={() => setDialog(null)}
        onSaveTask={actions.saveTask}
        onUpdateColumn={actions.updateColumn}
        onDeleteColumn={actions.deleteColumn}
      />
    </div>
  )
}
