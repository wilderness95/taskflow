import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import * as api from '../../api/auth'
import { useCurrentUser } from './useSession'
import '../../shared/styles/buttons.css'
import './VerifyEmailBanner.css'

/** Megerősítetlen e-mail-című felhasználónak figyelmeztetés és újraküldés. */
export function VerifyEmailBanner() {
  const { t } = useTranslation('auth')
  const user = useCurrentUser()
  const resend = useMutation({ mutationFn: api.resendVerification })

  if (!user || user.emailVerified) {
    return null
  }

  return (
    <div className="verify-banner" role="status">
      <span>{resend.isSuccess ? t('verifyBanner.sent') : t('verifyBanner.message')}</span>
      {!resend.isSuccess && (
        <button
          type="button"
          className="secondary-button"
          disabled={resend.isPending}
          onClick={() => resend.mutate()}
        >
          {t('verifyBanner.resend')}
        </button>
      )}
    </div>
  )
}
