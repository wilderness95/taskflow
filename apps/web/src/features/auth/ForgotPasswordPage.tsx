import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import * as api from '../../api/auth'
import { AuthLayout } from './AuthLayout'
import { authErrorKey } from './authErrors'

export function ForgotPasswordPage() {
  const { t } = useTranslation('auth')
  const [email, setEmail] = useState('')
  const request = useMutation({
    meta: { handlesErrors: true },
    mutationFn: (value: string) => api.forgotPassword({ email: value }),
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    request.mutate(email)
  }

  return (
    <AuthLayout
      title={t('forgot.title')}
      description={t('forgot.description')}
      footer={<Link to="/login">{t('forgot.back')}</Link>}
    >
      <form className="task-form" onSubmit={handleSubmit}>
        <label>
          {t('fields.email')}
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        {request.isSuccess && (
          <p className="auth-form-success" role="status">
            {t('forgot.sent')}
          </p>
        )}
        {request.isError && (
          <p className="auth-form-error" role="alert">
            {t(`errors.${authErrorKey(request.error)}`)}
          </p>
        )}
        <button type="submit" className="primary-button" disabled={request.isPending}>
          {t('forgot.submit')}
        </button>
      </form>
    </AuthLayout>
  )
}
