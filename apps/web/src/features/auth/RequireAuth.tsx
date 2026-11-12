import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { fetchHealth } from '../../api/health'
import { useCurrentUser } from './useSession'
import { VerifyEmailRequiredPage } from './VerifyEmailRequiredPage'

/** Védett route-ok burkolója: bejelentkezés nélkül a login oldalra visz, onnan vissza ide. */
export function RequireAuth() {
  const { t } = useTranslation('auth')
  const user = useCurrentUser()
  const location = useLocation()
  const health = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    staleTime: 60_000,
    meta: { handlesErrors: true },
  })

  if (user === undefined || (user && health.isPending)) {
    return (
      <p className="auth-loading" role="status">
        {t('loading')}
      </p>
    )
  }

  if (user === null) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }

  // Kötelező e-mail-megerősítés: a megerősítetlen felhasználó (a platform-admin kivételével) csak
  // a megerősítő oldalt látja. A szerver ezt is kényszeríti (`403 email_not_verified`).
  if (health.data?.emailVerificationRequired && !user.emailVerified && !user.isAdmin) {
    return <VerifyEmailRequiredPage user={user} />
  }

  return <Outlet />
}

/** Az auth oldalak (login, regisztráció) bejelentkezett felhasználónak a táblára irányítanak. */
export function GuestOnly() {
  const user = useCurrentUser()

  if (user) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
