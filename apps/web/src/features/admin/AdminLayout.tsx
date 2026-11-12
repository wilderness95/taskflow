import { useTranslation } from 'react-i18next'
import { Link, Navigate, NavLink, Outlet } from 'react-router'
import { UserMenu } from '../auth/UserMenu'
import { useCurrentUser } from '../auth/useSession'
import '../../shared/styles/base.css'
import '../../shared/styles/buttons.css'
import '../auth/AuthLayout.css'
import '../boards/Topbar.css'
import '../workspaces/WorkspacePage.css'
import '../workspaces/WorkspaceMembersPage.css'
import './AdminLayout.css'

/**
 * Platform-adminisztráció keretje. A guard csak kényelmi réteg: a nem platform-admin felhasználót
 * visszaküldi a kezdőlapra; a szerver minden admin végponton külön ellenőrzi a jogosultságot.
 */
export function AdminLayout() {
  const { t } = useTranslation(['admin', 'common'])
  const user = useCurrentUser()

  if (user && !user.isAdmin) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="app-shell">
      <div className="trello-surface">
        <header className="topbar workspace-topbar">
          <Link to="/" className="brand-wrap">
            <div className="brand-badge">T</div>
            <span className="brand-name">{t('common:appName')}</span>
          </Link>
          <div className="topbar-actions">
            <UserMenu />
          </div>
        </header>
        <main className="workspace-page admin-page">
          <section className="workspace-heading">
            <div>
              <span className="eyebrow">{t('admin:eyebrow')}</span>
              <h1>{t('admin:title')}</h1>
              <small>{t('admin:intro')}</small>
            </div>
            <Link to="/" className="secondary-button">
              {t('admin:back')}
            </Link>
          </section>
          <nav className="admin-tabs" aria-label={t('admin:navAria')}>
            <NavLink to="/admin" end>
              {t('admin:nav.overview')}
            </NavLink>
            <NavLink to="/admin/users">{t('admin:nav.users')}</NavLink>
          </nav>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
