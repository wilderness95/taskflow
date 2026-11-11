import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate } from 'react-router'
import { AuthLayout } from './AuthLayout'
import { authErrorKey } from './authErrors'
import { useAuthActions } from './useSession'

export function LoginPage() {
  const { t } = useTranslation('auth')
  const { login } = useAuthActions()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    login.mutate({ email, password }, { onSuccess: () => navigate(from, { replace: true }) })
  }

  return (
    <AuthLayout
      title={t('login.title')}
      footer={
        <>
          <Link to="/forgot-password">{t('login.forgot')}</Link>
          <span>
            {t('login.noAccount')} <Link to="/register">{t('login.register')}</Link>
          </span>
        </>
      }
    >
      <form className="task-form" onSubmit={handleSubmit}>
        <label>
          {t('fields.email')}
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          {t('fields.password')}
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        {login.isError && (
          <p className="auth-form-error" role="alert">
            {t(`errors.${authErrorKey(login.error)}`)}
          </p>
        )}
        <button type="submit" className="primary-button" disabled={login.isPending}>
          {t('login.submit')}
        </button>
      </form>
    </AuthLayout>
  )
}
