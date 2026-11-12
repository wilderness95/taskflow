import { listProgress, workspaceRoleCan } from '@taskflow/shared'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { rememberWorkspace } from '../../shared/lib/lastWorkspace'
import { WorkspaceTopbar } from '../workspaces/WorkspaceTopbar'
import { AddItemForm } from './AddItemForm'
import { ListBody } from './ListBody'
import { ListTitle } from './ListTitle'
import { ListToolbar } from './ListToolbar'
import { useListEvents } from './useListEvents'
import { useListMutations } from './useListMutations'
import { useList } from './useLists'
import '../../shared/styles/base.css'
import '../../shared/styles/buttons.css'
import '../workspaces/WorkspacePage.css'
import './ListPage.css'

/** Egy teendő- vagy bevásárlólista: tételek szakaszokban, valós idejű közös szerkesztéssel. */
export function ListPage() {
  const { t } = useTranslation('lists')
  const { listId = '' } = useParams()
  const query = useList(listId)
  const list = query.data
  const mutations = useListMutations(listId)
  useListEvents(listId, Boolean(list))

  useEffect(() => {
    if (list) rememberWorkspace(list.workspaceId)
  }, [list])

  if (!list) {
    return (
      <div className="app-shell">
        <div className="trello-surface">
          <main className="workspace-page">
            {query.isError ? <p role="alert">{t('page.loadError')}</p> : null}
          </main>
        </div>
      </div>
    )
  }

  const canWrite = workspaceRoleCan(list.myRole, 'list:write')
  const progress = listProgress(list.items)

  return (
    <div className="app-shell">
      <div className="trello-surface">
        <WorkspaceTopbar workspaceId={list.workspaceId} />
        <main className="workspace-page list-page">
          <section className="workspace-heading">
            <div className="list-heading-text">
              <span className="eyebrow">{t('page.eyebrow')}</span>
              <ListTitle
                title={list.title}
                readOnly={!canWrite}
                onChange={(title) => mutations.rename.mutate(title)}
              />
              <small>{t('page.progress', progress)}</small>
            </div>
            <div className="workspace-actions">
              <Link to={`/w/${list.workspaceId}/lists`} className="secondary-button">
                {t('page.back')}
              </Link>
            </div>
          </section>

          {canWrite ? (
            <>
              <AddItemForm sections={list.sections} mutations={mutations} />
              <ListToolbar list={list} mutations={mutations} />
            </>
          ) : (
            <p className="workspace-empty">{t('page.readOnly')}</p>
          )}
          <ListBody list={list} canWrite={canWrite} mutations={mutations} />
        </main>
      </div>
    </div>
  )
}
