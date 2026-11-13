import { useTranslation } from 'react-i18next'
import { formatDateTime } from '../../i18n/format'
import { Modal } from '../../shared/ui/Modal'
import { Avatar } from '../auth/Avatar'
import { UserActions } from './UserActions'
import { UserStatusBadges } from './UserStatusBadges'
import { useAdminUser } from './useAdmin'
import './UserDetailModal.css'

/** Egy felhasználó adatlapja: alapadatok, munkaterületek, munkamenetek és az adminműveletek. */
export function UserDetailModal({ userId, onClose }: { userId: string; onClose: () => void }) {
  const { t } = useTranslation(['admin', 'workspace'])
  const { data: user, isError } = useAdminUser(userId)

  return (
    <Modal eyebrow={t('admin:users.detail.eyebrow')} title={user?.name ?? ''} onClose={onClose}>
      {isError ? (
        <p role="alert">{t('admin:loadError')}</p>
      ) : !user ? (
        <p role="status">{t('admin:loading')}</p>
      ) : (
        <div className="user-detail">
          <div className="user-detail-head">
            <Avatar user={user} />
            <span className="members-identity">
              <strong>{user.email}</strong>
              <small>
                {t('admin:users.detail.registered', { date: formatDateTime(user.createdAt) })}
              </small>
            </span>
            <UserStatusBadges user={user} />
          </div>
          {user.suspendedAt && (
            <p className="admin-empty">
              {t('admin:users.detail.suspendedAt', { date: formatDateTime(user.suspendedAt) })}
            </p>
          )}

          <section>
            <h3>{t('admin:users.detail.workspaces')}</h3>
            {user.workspaces.length === 0 ? (
              <p className="admin-empty">{t('admin:users.detail.noWorkspaces')}</p>
            ) : (
              <ul className="user-detail-workspaces">
                {user.workspaces.map((workspace) => (
                  <li key={workspace.id}>
                    <span>{workspace.name}</span>
                    <small>{t(`workspace:roles.${workspace.role}`)}</small>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p>{t('admin:users.detail.sessions', { count: user.sessionCount })}</p>
          <UserActions user={user} />
        </div>
      )}
    </Modal>
  )
}
