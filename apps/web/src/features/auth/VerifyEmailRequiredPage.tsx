import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { UserDto } from '@taskflow/shared'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import * as api from '../../api/auth'
import { AuthLayout } from './AuthLayout'
import { ME_KEY, useAuthActions } from './useSession'

/**
 * Kötelező e-mail-megerősítésnél a megerősítetlen felhasználó csak ezt az oldalt látja:
 * újraküldheti a levelet, ellenőrizheti, hogy megerősítette-e már, vagy kijelentkezhet.
 */
export function VerifyEmailRequiredPage({ user }: { user: UserDto }) {
  const { t } = useTranslation('auth')
  const queryClient = useQueryClient()
  const { logout } = useAuthActions()
  const navigate = useNavigate()
  const resend = useMutation({ mutationFn: api.resendVerification })
  const check = useMutation({
    mutationFn: api.fetchMe,
    onSuccess: (me) => queryClient.setQueryData(ME_KEY, me),
  })
  const stillUnverified = check.isSuccess && check.data?.emailVerified === false

  return (
    <AuthLayout
      title={t('verifyRequired.title')}
      description={t('verifyRequired.message', { email: user.email })}
    >
      <div className="task-form">
        {resend.isSuccess && (
          <p className="auth-form-success" role="status">
            {t('verifyRequired.sent')}
          </p>
        )}
        {stillUnverified && (
          <p className="auth-form-error" role="alert">
            {t('verifyRequired.notYet')}
          </p>
        )}
        <button
          type="button"
          className="primary-button"
          disabled={check.isPending}
          onClick={() => check.mutate()}
        >
          {t('verifyRequired.check')}
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={resend.isPending}
          onClick={() => resend.mutate()}
        >
          {t('verifyRequired.resend')}
        </button>
        <button
          type="button"
          className="secondary-button"
          onClick={() =>
            logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })
          }
        >
          {t('verifyRequired.logout')}
        </button>
      </div>
    </AuthLayout>
  )
}
