import { useTranslation } from 'react-i18next'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useCurrentUser } from './useSession'

/** Védett route-ok burkolója: bejelentkezés nélkül a login oldalra visz, onnan vissza ide. */
export function RequireAuth() {
  const { t } = useTranslation('auth')
  const user = useCurrentUser()
  const location = useLocation()

  if (user === undefined) {
    return (
      <p className="auth-loading" role="status">
        {t('loading')}
      </p>
    )
  }

  if (user === null) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
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
