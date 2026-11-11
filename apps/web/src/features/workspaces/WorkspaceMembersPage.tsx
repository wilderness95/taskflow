import { workspaceRoleCan } from '@taskflow/shared'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { authErrorKey } from '../auth/authErrors'
import { InviteSection } from './InviteSection'
import { MemberList } from './MemberList'
import { WorkspaceSettings } from './WorkspaceSettings'
import { WorkspaceTopbar } from './WorkspaceTopbar'
import { useWorkspaceMembers } from './useWorkspaceMembers'
import { useWorkspace } from './useWorkspaces'
import '../../shared/styles/base.css'
import '../../shared/styles/buttons.css'
import '../auth/AuthLayout.css'
import './WorkspacePage.css'
import './WorkspaceMembersPage.css'

/** Tagok, szerepkörök, meghívók és beállítások egy munkaterületen. */
export function WorkspaceMembersPage() {
  const { t } = useTranslation(['workspace', 'auth', 'common'])
  const { workspaceId = '' } = useParams()
  const workspace = useWorkspace(workspaceId)
  const canManage = workspaceRoleCan(workspace?.role ?? null, 'workspace:manage_members')
  const actions = useWorkspaceMembers(workspaceId, canManage)

  const error = [
    actions.updateRole,
    actions.removeMember,
    actions.invite,
    actions.revoke,
    actions.rename,
    actions.deleteWorkspace,
  ].find((mutation) => mutation.isError)?.error

  return (
    <div className="app-shell">
      <div className="trello-surface">
        <WorkspaceTopbar workspaceId={workspaceId} />
        <main className="workspace-page members-page">
          {!workspace || actions.members.isError ? (
            <p role="alert">{t('workspace:membersPage.loadError')}</p>
          ) : (
            <>
              <section className="workspace-heading">
                <div>
                  <span className="eyebrow">{t('workspace:membersPage.eyebrow')}</span>
                  <h1>{workspace.name}</h1>
                  <small>{t(`workspace:roles.${workspace.role}`)}</small>
                </div>
                <Link to={`/w/${workspaceId}`} className="secondary-button">
                  {t('workspace:membersPage.back')}
                </Link>
              </section>

              {error && (
                <p className="auth-form-error" role="alert">
                  {t(`auth:errors.${authErrorKey(error)}`)}
                </p>
              )}

              <MemberList
                workspace={workspace}
                members={actions.members.data ?? []}
                actions={actions}
              />
              {canManage && <InviteSection workspace={workspace} actions={actions} />}
              <WorkspaceSettings key={workspace.name} workspace={workspace} actions={actions} />
            </>
          )}
        </main>
      </div>
    </div>
  )
}
