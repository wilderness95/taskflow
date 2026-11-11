import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import * as api from '../../api/auth'
import { AuthLayout } from './AuthLayout'
import { ME_KEY } from './useSession'

export function VerifyEmailPage() {
  const { t } = useTranslation('auth')
  const [params] = useSearchParams()
  const token = params.get('token')
  const queryClient = useQueryClient()
  const started = useRef(false)
  const verify = useMutation({
    meta: { handlesErrors: true },
    mutationFn: (value: string) => api.verifyEmail(value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ME_KEY }),
  })

  useEffect(() => {
    // A token egyszer használatos: a (StrictMode-os) dupla effekt-futás ne égesse el kétszer.
    if (token && !started.current) {
      started.current = true
      verify.mutate(token)
    }
  }, [token, verify])

  const status = !token || verify.isError ? 'failed' : verify.isSuccess ? 'success' : 'pending'

  return (
    <AuthLayout title={t('verify.title')} footer={<Link to="/">{t('verify.continue')}</Link>}>
      {status === 'pending' && <p role="status">{t('verify.pending')}</p>}
      {status === 'success' && (
        <p className="auth-form-success" role="status">
          {t('verify.success')}
        </p>
      )}
      {status === 'failed' && (
        <p className="auth-form-error" role="alert">
          {t('errors.invalid_token')}
        </p>
      )}
    </AuthLayout>
  )
}
