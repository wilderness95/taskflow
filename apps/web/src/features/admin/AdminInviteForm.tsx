import { INVITABLE_ROLES, type InvitableRole } from '@taskflow/shared'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { showToast } from '../../shared/ui/toast'
import { adminErrorKey } from './adminErrors'
import { useAdminWorkspaces, useInvitationActions } from './useAdmin'

/** Meghívó küldése: platform-regisztrációra (munkaterület nélkül) vagy egy munkaterületre szerepkörrel. */
export function AdminInviteForm({ actions }: { actions: ReturnType<typeof useInvitationActions> }) {
  const { t } = useTranslation(['admin', 'workspace'])
  const workspaces = useAdminWorkspaces()
  const [email, setEmail] = useState('')
  const [workspaceId, setWorkspaceId] = useState('')
  const [role, setRole] = useState<InvitableRole>('member')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    actions.create.mutate(workspaceId ? { email, workspaceId, role } : { email }, {
      onSuccess: () => {
        setEmail('')
        showToast({ message: t('admin:invitations.sent'), kind: 'success' })
      },
    })
  }

  return (
    <form className="members-invite-form" onSubmit={submit}>
      <label className="admin-field">
        <span>{t('admin:invitations.email')}</span>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label className="admin-field">
        <span>{t('admin:invitations.target')}</span>
        <select value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>
          <option value="">{t('admin:invitations.platform')}</option>
          {(workspaces.data ?? []).map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
      </label>
      {workspaceId && (
        <label className="admin-field">
          <span>{t('admin:invitations.role')}</span>
          <select value={role} onChange={(event) => setRole(event.target.value as InvitableRole)}>
            {INVITABLE_ROLES.map((option) => (
              <option key={option} value={option}>
                {t(`workspace:roles.${option}`)}
              </option>
            ))}
          </select>
        </label>
      )}
      <button type="submit" className="primary-button" disabled={actions.create.isPending}>
        {t('admin:invitations.send')}
      </button>
      {actions.create.isError && (
        <p className="auth-form-error" role="alert">
          {t(`admin:errors.${adminErrorKey(actions.create.error)}`)}
        </p>
      )}
    </form>
  )
}
