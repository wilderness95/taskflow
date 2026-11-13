import type { AdminUserDetailDto } from '@taskflow/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ConfirmModal } from '../../shared/ui/ConfirmModal'
import { showToast } from '../../shared/ui/toast'
import { useCurrentUser } from '../auth/useSession'
import { adminErrorKey } from './adminErrors'
import { PasswordConfirmModal } from './PasswordConfirmModal'
import { useUserActions, type UserAction } from './useAdmin'

/** Az érzékeny műveletek megerősítést kérnek; a felfüggesztés és az admin jog a jelszót is. */
type Pending = 'suspend' | 'revokeSessions' | 'grantAdmin' | 'revokeAdmin'

export function UserActions({ user }: { user: AdminUserDetailDto }) {
  const { t } = useTranslation('admin')
  const me = useCurrentUser()
  const { run, suspend, setAdminRole } = useUserActions(user.id)
  const [pending, setPending] = useState<Pending | null>(null)
  const isSelf = me?.id === user.id
  const busy = run.isPending || suspend.isPending || setAdminRole.isPending
  // A jelszóablak hibáját az ablak mutatja; a többi hiba az űrlap alatt jelenik meg.
  const error = pending ? undefined : [run, suspend, setAdminRole].find((m) => m.isError)?.error

  const open = (action: Pending) => {
    suspend.reset()
    setAdminRole.reset()
    setPending(action)
  }
  const done = (message: string) => ({
    onSuccess: () => {
      setPending(null)
      showToast({ message, kind: 'success' })
    },
  })
  const perform = (action: UserAction) => run.mutate(action, done(t(`users.done.${action}`)))
  const confirmWithPassword = (
    action: 'suspend' | 'grantAdmin' | 'revokeAdmin',
    password: string,
  ) => {
    if (action === 'suspend') {
      suspend.mutate(password, done(t('users.done.suspend')))
      return
    }
    const isAdmin = action === 'grantAdmin'
    setAdminRole.mutate({ isAdmin, password }, done(t(`users.done.${action}`)))
  }

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
            onClick={() => open('suspend')}
          >
            {t('users.actions.suspend')}
          </button>
        )}
        <button
          type="button"
          className="secondary-button"
          disabled={busy || user.sessionCount === 0}
          onClick={() => open('revokeSessions')}
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
          onClick={() => open(user.isAdmin ? 'revokeAdmin' : 'grantAdmin')}
        >
          {t(user.isAdmin ? 'users.actions.revokeAdmin' : 'users.actions.grantAdmin')}
        </button>
      </div>

      {pending === 'revokeSessions' && (
        <ConfirmModal
          eyebrow={t('users.confirm.eyebrow')}
          title={t('users.confirm.revokeSessions.title')}
          message={t('users.confirm.revokeSessions.message', { name: user.name })}
          confirmLabel={t('users.confirm.revokeSessions.confirm')}
          onConfirm={() => {
            setPending(null)
            perform('revokeSessions')
          }}
          onClose={() => setPending(null)}
        />
      )}
      {pending && pending !== 'revokeSessions' && (
        <PasswordConfirmModal
          eyebrow={t('users.confirm.eyebrow')}
          title={t(`users.confirm.${pending}.title`)}
          message={t(`users.confirm.${pending}.message`, { name: user.name })}
          confirmLabel={t(`users.confirm.${pending}.confirm`)}
          pending={suspend.isPending || setAdminRole.isPending}
          error={suspend.error ?? setAdminRole.error}
          onConfirm={(password) => confirmWithPassword(pending, password)}
          onClose={() => setPending(null)}
        />
      )}
    </>
  )
}
