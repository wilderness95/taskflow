import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { VerifyEmailBanner } from '../auth/VerifyEmailBanner'
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

const STATUS_KEYS = {
  loading: 'board:loading',
  error: 'board:loadError',
  notFound: 'board:notFound',
} as const

export function BoardPage() {
  const { t } = useTranslation(['card', 'column', 'board'])
  const { boardId = '' } = useParams()
  const { status, retry, columns, participants, meta, actions, workspaceId } = useBoardData(boardId)
  const [searchQuery, setSearchQuery] = useState('')
  const [dialog, setDialog] = useState<Dialog | null>(null)

  const drag = useBoardDrag({
    onMoveTask: actions.moveTask,
    onReorderColumns: actions.reorderColumns,
    enabled: meta.permissions.write,
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
          {t(STATUS_KEYS[status])}
        </p>
        {status === 'error' && (
          <button type="button" className="secondary-button" onClick={retry}>
            {t('board:retry')}
          </button>
        )}
        {status === 'notFound' && (
          <Link to="/" className="secondary-button">
            {t('board:backToWorkspace')}
          </Link>
        )}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="trello-surface">
        <VerifyEmailBanner />
        <Topbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          totalTasks={totalTasks}
          workspaceId={workspaceId}
        />

        <div className="workspace-layout">
          <main className="board-page">
            <BoardHeader
              meta={meta}
              onMembers={() => setDialog({ type: 'members' })}
              onAddColumn={handleAddColumn}
            />
            {!meta.permissions.write && (
              <p className="board-readonly-note" role="note">
                {t('board:readOnly')}
              </p>
            )}
            <BoardToolbar meta={meta} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
            <Board
              columns={visibleColumns}
              drag={drag}
              onRenameColumn={(columnId) => setDialog({ type: 'column-rename', columnId })}
              onDeleteColumn={handleDeleteColumn}
              onAddTask={(columnId) => setDialog({ type: 'card-create', columnId })}
              onEditTask={(columnId, task) => setDialog({ type: 'card-edit', columnId, task })}
              onDeleteTask={actions.deleteTask}
              readOnly={!meta.permissions.write}
            />
          </main>
        </div>
      </div>

      <BoardDialogs
        dialog={dialog}
        columns={columns}
        participants={participants}
        onClose={() => setDialog(null)}
        onSaveTask={actions.saveTask}
        onUpdateColumn={actions.updateColumn}
        onDeleteColumn={actions.deleteColumn}
        boardId={boardId}
        workspaceId={workspaceId ?? ''}
        canManageMembers={meta.permissions.manageMembers}
        isBoardAdmin={meta.permissions.update}
      />
    </div>
  )
}
