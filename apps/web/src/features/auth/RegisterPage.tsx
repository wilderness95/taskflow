import { PASSWORD_MIN_LENGTH } from '@taskflow/shared'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { AuthLayout } from './AuthLayout'
import { authErrorKey } from './authErrors'
import { useAuthActions } from './useSession'

export function RegisterPage() {
  const { t } = useTranslation('auth')
  const { register } = useAuthActions()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const inviteToken = params.get('invite') ?? undefined
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    register.mutate(
      { email, name, password, inviteToken },
      { onSuccess: () => navigate('/', { replace: true }) },
    )
  }

  return (
    <AuthLayout
      title={t('register.title')}
      footer={
        <span>
          {t('register.hasAccount')} <Link to="/login">{t('register.login')}</Link>
        </span>
      }
    >
      <form className="task-form" onSubmit={handleSubmit}>
        <label>
          {t('fields.name')}
          <input
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
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
        <label>
          {t('fields.password')}
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
        {register.isError && (
          <p className="auth-form-error" role="alert">
            {t(`errors.${authErrorKey(register.error)}`)}
          </p>
        )}
        <button type="submit" className="primary-button" disabled={register.isPending}>
          {t('register.submit')}
        </button>
      </form>
    </AuthLayout>
  )
}
