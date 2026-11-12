import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useDismiss } from '../../shared/hooks/useDismiss'
import { useCurrentUser } from '../auth/useSession'
import { NotificationItem } from './NotificationItem'
import { useNotifications } from './useNotifications'
import '../../shared/styles/menu.css'
import '../../shared/styles/buttons.css'
import './NotificationBell.css'

/** A harang ikon: olvasatlan-számláló és az értesítések listája (hozzárendelés, említés, határidő). */
export function NotificationBell() {
  const { t } = useTranslation('notification')
  const user = useCurrentUser()
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { notifications, unreadCount, isError, isLoading, markRead, markAllRead } =
    useNotifications()

  useDismiss(ref, isOpen, () => setIsOpen(false))

  if (!user) return null

  return (
    <div className="notification-bell" ref={ref}>
      <button
        type="button"
        className="icon-button"
        aria-label={t('aria', { count: unreadCount })}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        ◔
        {unreadCount > 0 && (
          <span className="notification-badge" aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="menu-panel notification-panel">
          <div className="notification-header">
            <strong>{t('title')}</strong>
            {unreadCount > 0 && (
              <button type="button" className="notification-link" onClick={markAllRead}>
                {t('markAllRead')}
              </button>
            )}
          </div>
          {isError && <p role="alert">{t('loadError')}</p>}
          {isLoading && <p role="status">{t('loading')}</p>}
          {!isLoading && !isError && notifications.length === 0 && (
            <p className="notification-empty">{t('empty')}</p>
          )}
          <ul className="notification-list">
            {notifications.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onOpen={() => {
                  if (!notification.readAt) markRead(notification.id)
                  setIsOpen(false)
                  navigate(`/b/${notification.boardId}?card=${notification.cardId}`)
                }}
              />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
