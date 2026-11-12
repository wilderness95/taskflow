import { workspaceRoleCan } from '@taskflow/shared'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { rememberWorkspace } from '../../shared/lib/lastWorkspace'
import { CreateBoardModal } from './CreateBoardModal'
import { WorkspaceBoardCard } from './WorkspaceBoardCard'
import { WorkspaceTopbar } from './WorkspaceTopbar'
import { useArchivedBoards, useToggleStar, useWorkspace, useWorkspaceBoards } from './useWorkspaces'
import '../../shared/styles/base.css'
import '../../shared/styles/buttons.css'
import './WorkspacePage.css'

/** Egy munkaterület tábláinak listája; a csillagozott táblák külön szekcióban. */
export function WorkspacePage() {
  const { t } = useTranslation(['workspace', 'common', 'archive', 'lists'])
  const { workspaceId = '' } = useParams()
  const workspace = useWorkspace(workspaceId)
  const boards = useWorkspaceBoards(workspaceId)
  const toggleStar = useToggleStar(workspaceId)
  const archived = useArchivedBoards(workspaceId)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (workspace) rememberWorkspace(workspace.id)
  }, [workspace])

  const all = boards.data ?? []
  const starred = all.filter((board) => board.starred)
  const canCreate = workspaceRoleCan(workspace?.role ?? null, 'board:create')
  const canManageMembers = workspaceRoleCan(workspace?.role ?? null, 'workspace:manage_members')

  return (
    <div className="app-shell">
      <div className="trello-surface">
        <WorkspaceTopbar workspaceId={workspaceId} />

        <main className="workspace-page">
          {boards.isError || (!workspace && !boards.isPending) ? (
            <p role="alert">{t('boards.loadError')}</p>
          ) : (
            <>
              <section className="workspace-heading">
                <div>
                  <span className="eyebrow">{t('boards.eyebrow')}</span>
                  <h1>{workspace?.name}</h1>
                  {workspace && <small>{t(`roles.${workspace.role}`)}</small>}
                </div>
                <div className="workspace-actions">
                  <Link to={`/w/${workspaceId}/lists`} className="secondary-button">
                    {t('lists:nav.lists')}
                  </Link>
                  <Link to={`/w/${workspaceId}/members`} className="secondary-button">
                    {canManageMembers ? t('boards.manageMembers') : t('boards.members')}
                  </Link>
                  {canCreate && (
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => setIsCreating(true)}
                    >
                      {t('boards.create')}
                    </button>
                  )}
                </div>
              </section>

              {starred.length > 0 && (
                <section aria-label={t('boards.starred')}>
                  <h2>{t('boards.starred')}</h2>
                  <div className="workspace-board-grid">
                    {starred.map((board) => (
                      <WorkspaceBoardCard
                        key={board.id}
                        board={board}
                        onToggleStar={() => toggleStar.mutate(board)}
                      />
                    ))}
                  </div>
                </section>
              )}

              <section aria-label={t('boards.all')}>
                <h2>{t('boards.all')}</h2>
                {all.length === 0 && !boards.isPending ? (
                  <p className="workspace-empty">{t('boards.empty')}</p>
                ) : (
                  <div className="workspace-board-grid">
                    {all.map((board) => (
                      <WorkspaceBoardCard
                        key={board.id}
                        board={board}
                        onToggleStar={() => toggleStar.mutate(board)}
                      />
                    ))}
                  </div>
                )}
              </section>

              {(archived.query.data?.length ?? 0) > 0 && (
                <section aria-label={t('archive:boards.title')}>
                  <h2>{t('archive:boards.title')}</h2>
                  <ul className="workspace-archived-list">
                    {archived.query.data?.map((board) => (
                      <li key={board.id}>
                        <span>{board.title}</span>
                        <button
                          type="button"
                          className="secondary-button"
                          aria-label={t('archive:boards.restoreAria', { title: board.title })}
                          disabled={archived.restore.isPending}
                          onClick={() => archived.restore.mutate(board.id)}
                        >
                          {t('archive:boards.restore')}
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </main>
      </div>

      {isCreating && (
        <CreateBoardModal workspaceId={workspaceId} onClose={() => setIsCreating(false)} />
      )}
    </div>
  )
}
