import type { AdminInvitationDto } from '@taskflow/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatDateTime } from '../../i18n/format'
import { ConfirmModal } from '../../shared/ui/ConfirmModal'
import { showToast } from '../../shared/ui/toast'
import { adminErrorKey } from './adminErrors'
import { useInvitationActions } from './useAdmin'
import './UserStatusBadges.css'

type Props = {
  invitations: AdminInvitationDto[]
  actions: ReturnType<typeof useInvitationActions>
}

export function AdminInvitationList({ invitations, actions }: Props) {
  const { t } = useTranslation(['admin', 'workspace'])
  const [toRevoke, setToRevoke] = useState<AdminInvitationDto | null>(null)
  const error = [actions.resend, actions.revoke].find((mutation) => mutation.isError)?.error

  if (invitations.length === 0) {
    return <p className="admin-empty">{t('admin:invitations.empty')}</p>
  }

  const resend = (id: string) =>
    actions.resend.mutate(id, {
      onSuccess: () => showToast({ message: t('admin:invitations.resent'), kind: 'success' }),
    })

  return (
    <>
      {error && (
        <p className="auth-form-error" role="alert">
          {t(`admin:errors.${adminErrorKey(error)}`)}
        </p>
      )}
      <ul className="members-list">
        {invitations.map((invitation) => (
          <li key={invitation.id}>
            <span className="members-identity">
              <strong>{invitation.email}</strong>
              <small>
                {invitation.workspaceName && invitation.role
                  ? t('admin:invitations.workspaceRole', {
                      workspace: invitation.workspaceName,
                      role: t(`workspace:roles.${invitation.role}`),
                    })
                  : t('admin:invitations.platform')}
                {invitation.invitedByName && ` · ${invitation.invitedByName}`}
              </small>
              <small>
                {t('admin:invitations.sentAt', { date: formatDateTime(invitation.createdAt) })}
                {' · '}
                {t('admin:invitations.expiresAt', { date: formatDateTime(invitation.expiresAt) })}
              </small>
            </span>
            <span className={`user-badge invitation-${invitation.status}`}>
              {t(`admin:invitations.statuses.${invitation.status}`)}
            </span>
            {(invitation.status === 'pending' || invitation.status === 'expired') && (
              <button
                type="button"
                className="secondary-button"
                disabled={actions.resend.isPending}
                onClick={() => resend(invitation.id)}
              >
                {t('admin:invitations.resend')}
              </button>
            )}
            {invitation.status === 'pending' && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => setToRevoke(invitation)}
              >
                {t('admin:invitations.revoke')}
              </button>
            )}
          </li>
        ))}
      </ul>
      {toRevoke && (
        <ConfirmModal
          eyebrow={t('admin:invitations.confirm.eyebrow')}
          title={t('admin:invitations.confirm.title')}
          message={t('admin:invitations.confirm.message', { email: toRevoke.email })}
          confirmLabel={t('admin:invitations.revoke')}
          onConfirm={() => {
            actions.revoke.mutate(toRevoke.id)
            setToRevoke(null)
          }}
          onClose={() => setToRevoke(null)}
        />
      )}
    </>
  )
}
