import type { AdminUserDto } from '@taskflow/shared'
import { useTranslation } from 'react-i18next'
import './UserStatusBadges.css'

/** Egy felhasználó állapotjelvényei: admin, felfüggesztett, megerősítetlen e-mail-cím. */
export function UserStatusBadges({ user }: { user: AdminUserDto }) {
  const { t } = useTranslation('admin')
  return (
    <span className="user-badges">
      {user.isAdmin && (
        <span className="user-badge user-badge-admin">{t('users.badge.admin')}</span>
      )}
      {user.suspended && (
        <span className="user-badge user-badge-suspended">{t('users.badge.suspended')}</span>
      )}
      {!user.emailVerified && (
        <span className="user-badge user-badge-unverified">{t('users.badge.unverified')}</span>
      )}
    </span>
  )
}
