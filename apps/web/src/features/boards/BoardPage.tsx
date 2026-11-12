import { countActiveFilters, EMPTY_BOARD_FILTER, type BoardFilter } from '@taskflow/shared'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { VerifyEmailBanner } from '../auth/VerifyEmailBanner'
import { Board } from './Board'
import { BoardDialogs } from './BoardDialogs'
import { BoardHeader } from './BoardHeader'
import { BoardAltView } from '../views/BoardAltView'
import { BoardFilterPanel } from '../filters/BoardFilterPanel'
import { BoardToolbar } from './BoardToolbar'
import { applyBoardFilter, countTasks, filterColumns } from './filterColumns'
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
  const { status, retry, columns, participants, meta, actions, workspaceId, labels } =
    useBoardData(boardId)
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<BoardFilter>(EMPTY_BOARD_FILTER)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [dialog, setDialog] = useState<Dialog | null>(null)

  const drag = useBoardDrag({
    onMoveTask: actions.moveTask,
    onReorderColumns: actions.reorderColumns,
    enabled: meta.permissions.write,
  })

  // Értesítésből érkezve (`?card=<id>`) a kártya szerkesztője nyílik meg.
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedCardId = searchParams.get('card')
  useEffect(() => {
    if (!requestedCardId || status !== 'ready') return
    for (const [columnId, column] of Object.entries(columns)) {
      const task = column.tasks.find((candidate) => candidate.id === requestedCardId)
      if (task) {
        setDialog(meta.permissions.write ? { type: 'card-edit', columnId, task } : null)
        break
      }
    }
    setSearchParams({}, { replace: true })
  }, [requestedCardId, status, columns, meta.permissions.write, setSearchParams])

  const visibleColumns = useMemo(
    () =>
      applyBoardFilter(
        filterColumns(columns, searchQuery, (priority) => t(`card:priority.${priority}`)),
        filter,
      ),
    [columns, searchQuery, filter, t],
  )
  const totalTasks = useMemo(() => countTasks(columns), [columns])

  const handleAddColumn = () => {
    const index = Object.keys(columns).length
    actions.addColumn(
      t('column:defaultTitle', { number: index + 1 }),
      COLUMN_ACCENTS[index % COLUMN_ACCENTS.length] ?? 'blue',
    )
  }

  const navigate = useNavigate()
  const handleArchiveBoard = () => {
    actions.archiveBoard().then(() => navigate(workspaceId ? `/w/${workspaceId}` : '/'))
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
              onActivity={() => setDialog({ type: 'activity' })}
              onLabels={() => setDialog({ type: 'labels' })}
              onArchive={() => setDialog({ type: 'archive' })}
              onArchiveBoard={() => setDialog({ type: 'board-archive' })}
              onAddColumn={handleAddColumn}
            />
            {!meta.permissions.write && (
              <p className="board-readonly-note" role="note">
                {t('board:readOnly')}
              </p>
            )}
            <BoardToolbar
              meta={meta}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              activeFilterCount={countActiveFilters(filter)}
              filtersOpen={filtersOpen}
              onToggleFilters={() => setFiltersOpen((open) => !open)}
            />
            {filtersOpen && (
              <BoardFilterPanel
                boardId={boardId}
                filter={filter}
                onChange={setFilter}
                labels={labels}
                participants={participants}
              />
            )}
            {meta.activeView === 'kanban' ? (
              <Board
                columns={visibleColumns}
                drag={drag}
                onRenameColumn={(columnId) => setDialog({ type: 'column-rename', columnId })}
                onDeleteColumn={handleDeleteColumn}
                onAddTask={(columnId) => setDialog({ type: 'card-create', columnId })}
                onEditTask={(columnId, task) => setDialog({ type: 'card-edit', columnId, task })}
                onDeleteTask={actions.deleteTask}
                onArchiveColumn={actions.archiveColumn}
                onArchiveTask={actions.archiveTask}
                readOnly={!meta.permissions.write}
              />
            ) : (
              <BoardAltView
                view={meta.activeView}
                columns={visibleColumns}
                onOpenTask={
                  meta.permissions.write
                    ? (columnId, task) => setDialog({ type: 'card-edit', columnId, task })
                    : undefined
                }
              />
            )}
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
        onArchiveBoard={handleArchiveBoard}
        boardId={boardId}
        workspaceId={workspaceId ?? ''}
        canManageMembers={meta.permissions.manageMembers}
        canWrite={meta.permissions.write}
        isBoardAdmin={meta.permissions.update}
      />
    </div>
  )
}
