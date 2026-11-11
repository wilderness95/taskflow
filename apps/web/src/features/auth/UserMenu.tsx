import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useDismiss } from '../../shared/hooks/useDismiss'
import { Avatar } from './Avatar'
import { ProfileModal } from './ProfileModal'
import { useAuthActions, useCurrentUser } from './useSession'
import '../../shared/styles/menu.css'
import './UserMenu.css'

export function UserMenu() {
  const { t } = useTranslation('auth')
  const user = useCurrentUser()
  const { logout } = useAuthActions()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useDismiss(ref, isOpen, () => setIsOpen(false))

  if (!user) {
    return null
  }

  return (
    <div className="user-menu" ref={ref}>
      <button
        type="button"
        className="user-menu-trigger"
        aria-label={t('menu.aria')}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Avatar user={user} />
      </button>
      {isOpen && (
        <div className="menu-panel">
          <div className="user-menu-identity">
            <strong>{user.name}</strong>
            <small>{user.email}</small>
          </div>
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              setIsOpen(false)
              setIsProfileOpen(true)
            }}
          >
            {t('menu.profile')}
          </button>
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              setIsOpen(false)
              logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })
            }}
          >
            {t('menu.logout')}
          </button>
        </div>
      )}
      {isProfileOpen && <ProfileModal onClose={() => setIsProfileOpen(false)} />}
    </div>
  )
}
