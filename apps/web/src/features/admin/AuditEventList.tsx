import type { AuditEventDto } from '@taskflow/shared'
import { useTranslation } from 'react-i18next'
import { formatDateTime } from '../../i18n/format'
import { auditActionKey, auditTarget } from './auditEvents'
import './AuditEventList.css'

/** Az auditnapló eseményei, legújabb elöl: ki, mit, kivel és mikor. */
export function AuditEventList({ events }: { events: AuditEventDto[] }) {
  const { t } = useTranslation('admin')

  if (events.length === 0) {
    return <p className="admin-empty">{t('audit.empty')}</p>
  }

  return (
    <ul className="audit-list">
      {events.map((event) => (
        <li key={event.id}>
          <span>
            {t(`audit.actions.${auditActionKey(event.action)}`, {
              actor: event.actorName ?? t('audit.unknownActor'),
              target: auditTarget(event) ?? t('audit.unknownTarget'),
            })}
          </span>
          <small>
            <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
            {event.ip && <span className="audit-ip">{event.ip}</span>}
          </small>
        </li>
      ))}
    </ul>
  )
}
