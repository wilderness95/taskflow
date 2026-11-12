import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import * as api from '../../api/workspaces'
import { AuthLayout } from './AuthLayout'
import { authErrorKey } from './authErrors'
import { useCurrentUser } from './useSession'

/** A meghívó e-mailben kapott hivatkozásának célja: bejelentkezve elfogadható, egyébként belépés/regisztráció. */
export function AcceptInvitationPage() {
  const { t } = useTranslation(['workspace', 'auth'])
  const user = useCurrentUser()
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const token = params.get('token')
  const email = params.get('email') ?? ''
  const accept = useMutation({
    meta: { handlesErrors: true },
    mutationFn: (value: string) => api.acceptInvitation(value),
    onSuccess: (workspace) => navigate(`/w/${workspace.id}`, { replace: true }),
  })

  if (!token) {
    return (
      <AuthLayout title={t('accept.title')}>
        <p className="auth-form-error" role="alert">
          {t('accept.missingToken')}
        </p>
      </AuthLayout>
    )
  }

  if (user === undefined) {
    return (
      <p className="auth-loading" role="status">
        …
      </p>
    )
  }

  if (user === null) {
    const from = location.pathname + location.search
    const registerQuery = new URLSearchParams({ invite: token, email }).toString()
    return (
      <AuthLayout
        title={t('accept.title')}
        description={t('accept.needLogin')}
        footer={
          <>
            <Link to="/login" state={{ from }}>
              {t('accept.login')}
            </Link>
            <Link to={`/register?${registerQuery}`}>{t('accept.register')}</Link>
          </>
        }
      >
        <span />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title={t('accept.title')} description={t('accept.description')}>
      {accept.isError && (
        <p className="auth-form-error" role="alert">
          {t(`auth:errors.${authErrorKey(accept.error)}`)}
        </p>
      )}
      <button
        type="button"
        className="primary-button"
        disabled={accept.isPending}
        onClick={() => accept.mutate(token)}
      >
        {t('accept.submit')}
      </button>
    </AuthLayout>
  )
}
