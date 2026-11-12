import { workspaceRoleCan } from '@taskflow/shared'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { rememberWorkspace } from '../../shared/lib/lastWorkspace'
import { WorkspaceTopbar } from '../workspaces/WorkspaceTopbar'
import { useWorkspace } from '../workspaces/useWorkspaces'
import { CreateListModal } from './CreateListModal'
import { useArchivedLists, useWorkspaceLists } from './useLists'
import '../../shared/styles/base.css'
import '../../shared/styles/buttons.css'
import '../workspaces/WorkspacePage.css'
import './ListsPage.css'

/** Egy munkaterület listái (teendő- és bevásárlólisták); az archiváltak innen állíthatók vissza. */
export function ListsPage() {
  const { t } = useTranslation(['lists', 'common'])
  const { workspaceId = '' } = useParams()
  const workspace = useWorkspace(workspaceId)
  const lists = useWorkspaceLists(workspaceId)
  const archived = useArchivedLists(workspaceId)
  const [isCreating, setIsCreating] = useState(false)

  useEffect(() => {
    if (workspace) rememberWorkspace(workspace.id)
  }, [workspace])

  const canWrite = workspaceRoleCan(workspace?.role ?? null, 'list:write')
  const all = lists.data ?? []

  return (
    <div className="app-shell">
      <div className="trello-surface">
        <WorkspaceTopbar workspaceId={workspaceId} />
        <main className="workspace-page">
          {lists.isError ? (
            <p role="alert">{t('lists:overview.loadError')}</p>
          ) : (
            <>
              <section className="workspace-heading">
                <div>
                  <span className="eyebrow">{t('lists:overview.eyebrow')}</span>
                  <h1>{t('lists:overview.title')}</h1>
                  <small>{workspace?.name}</small>
                </div>
                <div className="workspace-actions">
                  <Link to={`/w/${workspaceId}`} className="secondary-button">
                    {t('lists:overview.backToBoards')}
                  </Link>
                  {canWrite && (
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => setIsCreating(true)}
                    >
                      {t('lists:overview.create')}
                    </button>
                  )}
                </div>
              </section>

              {all.length === 0 && !lists.isPending ? (
                <p className="workspace-empty">{t('lists:overview.empty')}</p>
              ) : (
                <ul className="lists-grid">
                  {all.map((list) => (
                    <li key={list.id}>
                      <Link to={`/l/${list.id}`} className="lists-card">
                        <strong>{list.title}</strong>
                        <span className="lists-card-meta">
                          {t('lists:overview.progress', {
                            done: list.doneCount,
                            total: list.itemCount,
                          })}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              {canWrite && (archived.query.data?.length ?? 0) > 0 && (
                <section aria-label={t('lists:overview.archived')}>
                  <h2>{t('lists:overview.archived')}</h2>
                  <ul className="workspace-archived-list">
                    {archived.query.data?.map((list) => (
                      <li key={list.id}>
                        <span>{list.title}</span>
                        <button
                          type="button"
                          className="secondary-button"
                          aria-label={t('lists:overview.restoreAria', { title: list.title })}
                          disabled={archived.restore.isPending}
                          onClick={() => archived.restore.mutate(list.id)}
                        >
                          {t('lists:overview.restore')}
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
        <CreateListModal workspaceId={workspaceId} onClose={() => setIsCreating(false)} />
      )}
    </div>
  )
}
