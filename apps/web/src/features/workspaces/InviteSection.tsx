import {
  INVITABLE_ROLES,
  canManageMember,
  type InvitableRole,
  type WorkspaceDto,
} from '@taskflow/shared'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { formatShortDate } from '../../i18n/format'
import type { useWorkspaceMembers } from './useWorkspaceMembers'

type InviteSectionProps = {
  workspace: WorkspaceDto
  actions: ReturnType<typeof useWorkspaceMembers>
}

/** E-mailes meghívás szerepkörrel, és a függő meghívók listája visszavonással. */
export function InviteSection({ workspace, actions }: InviteSectionProps) {
  const { t } = useTranslation('workspace')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InvitableRole>('member')
  const roles = INVITABLE_ROLES.filter((value) => canManageMember(workspace.role, 'member', value))

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (email.trim()) {
      actions.invite.mutate({ email, role }, { onSuccess: () => setEmail('') })
    }
  }

  return (
    <section aria-label={t('membersPage.invite.title')}>
      <h2>{t('membersPage.invite.title')}</h2>
      <form className="members-invite-form" onSubmit={handleSubmit}>
        <input
          type="email"
          required
          value={email}
          placeholder={t('membersPage.invite.emailPlaceholder')}
          aria-label={t('membersPage.invite.email')}
          onChange={(event) => setEmail(event.target.value)}
        />
        <select
          value={role}
          aria-label={t('membersPage.invite.role')}
          onChange={(event) => setRole(event.target.value as InvitableRole)}
        >
          {roles.map((value) => (
            <option key={value} value={value}>
              {t(`roles.${value}`)}
            </option>
          ))}
        </select>
        <button type="submit" className="primary-button" disabled={actions.invite.isPending}>
          {t('membersPage.invite.submit')}
        </button>
      </form>
      {actions.invite.isSuccess && <p role="status">{t('membersPage.invite.sent')}</p>}

      <h3>{t('membersPage.pending.title')}</h3>
      {actions.invitations.data?.length === 0 ? (
        <p className="workspace-empty">{t('membersPage.pending.empty')}</p>
      ) : (
        <ul className="members-list">
          {actions.invitations.data?.map((invitation) => (
            <li key={invitation.id}>
              <span className="members-identity">
                <strong>{invitation.email}</strong>
                <small>
                  {t(`roles.${invitation.role}`)} · {t('membersPage.pending.expires')}{' '}
                  {formatShortDate(invitation.expiresAt)}
                </small>
              </span>
              <button
                type="button"
                className="secondary-button"
                onClick={() => actions.revoke.mutate(invitation.id)}
              >
                {t('membersPage.pending.revoke')}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
