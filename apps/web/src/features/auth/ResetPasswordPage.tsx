import { PASSWORD_MIN_LENGTH } from '@taskflow/shared'
import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import * as api from '../../api/auth'
import { AuthLayout } from './AuthLayout'
import { authErrorKey } from './authErrors'

export function ResetPasswordPage() {
  const { t } = useTranslation('auth')
  const [params] = useSearchParams()
  const token = params.get('token')
  const [password, setPassword] = useState('')
  const reset = useMutation({
    meta: { handlesErrors: true },
    mutationFn: (value: string) => api.resetPassword({ token: token ?? '', password: value }),
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    reset.mutate(password)
  }

  if (!token) {
    return (
      <AuthLayout
        title={t('reset.title')}
        footer={<Link to="/forgot-password">{t('reset.requestNew')}</Link>}
      >
        <p className="auth-form-error" role="alert">
          {t('errors.invalid_token')}
        </p>
      </AuthLayout>
    )
  }

  if (reset.isSuccess) {
    return (
      <AuthLayout title={t('reset.title')} footer={<Link to="/login">{t('reset.toLogin')}</Link>}>
        <p className="auth-form-success" role="status">
          {t('reset.done')}
        </p>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t('reset.title')}>
      <form className="task-form" onSubmit={handleSubmit}>
        <label>
          {t('reset.newPassword')}
          <input
            type="password"
            autoComplete="new-password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <small>{t('register.passwordHint', { count: PASSWORD_MIN_LENGTH })}</small>
        </label>
        {reset.isError && (
          <p className="auth-form-error" role="alert">
            {t(`errors.${authErrorKey(reset.error)}`)}
          </p>
        )}
        <button type="submit" className="primary-button" disabled={reset.isPending}>
          {t('reset.submit')}
        </button>
      </form>
    </AuthLayout>
  )
}
