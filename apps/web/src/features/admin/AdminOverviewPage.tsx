import { useTranslation } from 'react-i18next'
import { formatDateTime, formatNumber } from '../../i18n/format'
import { AuditEventList } from './AuditEventList'
import { useAdminOverview } from './useAdmin'
import './AdminOverviewPage.css'

/** Admin áttekintő: számok, alapvető rendszerállapot és a legutóbbi események. */
export function AdminOverviewPage() {
  const { t } = useTranslation('admin')
  const { data, isError, isPending } = useAdminOverview()

  if (isError) return <p role="alert">{t('loadError')}</p>
  if (isPending) {
    return (
      <p role="status" className="admin-empty">
        {t('loading')}
      </p>
    )
  }

  const stats = [
    { key: 'total', value: data.users.total },
    { key: 'admins', value: data.users.admins },
    { key: 'suspended', value: data.users.suspended },
    { key: 'unverified', value: data.users.unverified },
    { key: 'pendingInvitations', value: data.pendingInvitations },
  ] as const

  return (
    <>
      <section className="admin-section" aria-label={t('overview.stats')}>
        <h2>{t('overview.stats')}</h2>
        <dl className="admin-stats">
          {stats.map((stat) => (
            <div key={stat.key} className="admin-stat">
              <dt>{t(`overview.${stat.key}`)}</dt>
              <dd>{formatNumber(stat.value)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="admin-section" aria-label={t('overview.health')}>
        <h2>{t('overview.health')}</h2>
        <ul className="admin-health">
          <li data-state={data.health.database}>
            <span>{t('overview.database')}</span>
            <strong>{t(`overview.state.${data.health.database}`)}</strong>
          </li>
          <li>
            <span>{t('overview.mail')}</span>
            <strong>{t(`overview.mailTransport.${data.health.mailTransport}`)}</strong>
          </li>
          <li>
            <span>{t('overview.backup')}</span>
            <strong>
              {data.health.lastBackupAt
                ? formatDateTime(data.health.lastBackupAt)
                : t('overview.backupUnknown')}
            </strong>
          </li>
        </ul>
      </section>

      <section className="admin-section" aria-label={t('overview.recent')}>
        <h2>{t('overview.recent')}</h2>
        <AuditEventList events={data.recentEvents} />
      </section>
    </>
  )
}
