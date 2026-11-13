import type { AdminUserDto } from '@taskflow/shared'
import { useTranslation } from 'react-i18next'
import { Avatar } from '../auth/Avatar'
import { UserStatusBadges } from './UserStatusBadges'

type AdminUserListProps = {
  users: AdminUserDto[]
  onSelect: (id: string) => void
}

export function AdminUserList({ users, onSelect }: AdminUserListProps) {
  const { t } = useTranslation('admin')

  if (users.length === 0) {
    return <p className="admin-empty">{t('users.empty')}</p>
  }

  return (
    <ul className="members-list">
      {users.map((user) => (
        <li key={user.id}>
          <button
            type="button"
            className="admin-user-row"
            aria-label={t('users.open', { name: user.name })}
            onClick={() => onSelect(user.id)}
          >
            <Avatar user={user} />
            <span className="members-identity">
              <strong>{user.name}</strong>
              <small>{user.email}</small>
            </span>
            <UserStatusBadges user={user} />
          </button>
        </li>
      ))}
    </ul>
  )
}
