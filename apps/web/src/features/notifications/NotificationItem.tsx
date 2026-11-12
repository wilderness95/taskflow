import type { NotificationDto } from '@taskflow/shared'
import { useTranslation } from 'react-i18next'
import { formatDateTime, formatShortDate } from '../../i18n/format'
import { classNames } from '../../shared/lib/classNames'

type NotificationItemProps = { notification: NotificationDto; onOpen: () => void }

export function NotificationItem({ notification, onOpen }: NotificationItemProps) {
  const { t } = useTranslation('notification')
  const params = {
    actor: notification.actorName ?? t('unknownActor'),
    card: notification.cardTitle,
    date: notification.dueDate ? formatShortDate(notification.dueDate) : '',
  }

  return (
    <li>
      <button
        type="button"
        className={classNames('notification-item', !notification.readAt && 'is-unread')}
        onClick={onOpen}
      >
        <span className="notification-text">{t(`types.${notification.type}`, params)}</span>
        <time dateTime={notification.createdAt}>{formatDateTime(notification.createdAt)}</time>
      </button>
    </li>
  )
}
