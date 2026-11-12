import type { AdminUserDetailDto } from '@taskflow/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmModal } from '../../shared/ui/ConfirmModal'
import { showToast } from '../../shared/ui/toast'
import { useCurrentUser } from '../auth/useSession'
import { adminErrorKey } from './adminErrors'
import { useUserActions, type UserAction } from './useAdmin'

/** Az érzékeny műveletek (felfüggesztés, kijelentkeztetés, admin jog) megerősítést kérnek. */
type Pending = 'suspend' | 'revokeSessions' | 'grantAdmin' | 'revokeAdmin'

export function UserActions({ user }: { user: AdminUserDetailDto }) {
  const { t } = useTranslation('admin')
  const me = useCurrentUser()
  const { run, setAdminRole } = useUserActions(user.id)
  const [pending, setPending] = useState<Pending | null>(null)
  const error = [run, setAdminRole].find((mutation) => mutation.isError)?.error
  const isSelf = me?.id === user.id

  const done = (message: string) => ({
    onSuccess: () => showToast({ message, kind: 'success' }),
  })
  const perform = (action: UserAction) => run.mutate(action, done(t(`users.done.${action}`)))
  const confirm = (action: Pending) => {
    setPending(null)
    if (action === 'suspend' || action === 'revokeSessions') perform(action)
    else {
      const grant = action === 'grantAdmin'
      setAdminRole.mutate(
        grant,
        done(t(grant ? 'users.done.grantAdmin' : 'users.done.revokeAdmin')),
      )
    }
  }
  const busy = run.isPending || setAdminRole.isPending

  return (
    <>
      {error && (
        <p className="auth-form-error" role="alert">
          {t(`errors.${adminErrorKey(error)}`)}
        </p>
      )}
      <div className="user-detail-actions">
        {user.suspended ? (
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => perform('restore')}
          >
            {t('users.actions.restore')}
          </button>
        ) : (
          <button
            type="button"
            className="secondary-button"
            disabled={busy || isSelf}
            title={isSelf ? t('errors.cannot_suspend_self') : undefined}
            onClick={() => setPending('suspend')}
          >
            {t('users.actions.suspend')}
          </button>
        )}
        <button
          type="button"
          className="secondary-button"
          disabled={busy || user.sessionCount === 0}
          onClick={() => setPending('revokeSessions')}
        >
          {t('users.actions.revokeSessions')}
        </button>
        {!user.emailVerified && (
          <button
            type="button"
            className="secondary-button"
            disabled={busy}
            onClick={() => perform('resendVerification')}
          >
            {t('users.actions.resendVerification')}
          </button>
        )}
        <button
          type="button"
          className="secondary-button"
          disabled={busy}
          onClick={() => setPending(user.isAdmin ? 'revokeAdmin' : 'grantAdmin')}
        >
          {t(user.isAdmin ? 'users.actions.revokeAdmin' : 'users.actions.grantAdmin')}
        </button>
      </div>

      {pending && (
        <ConfirmModal
          eyebrow={t('users.confirm.eyebrow')}
          title={t(`users.confirm.${pending}.title`)}
          message={t(`users.confirm.${pending}.message`, { name: user.name })}
          confirmLabel={t(`users.confirm.${pending}.confirm`)}
          onConfirm={() => confirm(pending)}
          onClose={() => setPending(null)}
        />
      )}
    </>
  )
}
