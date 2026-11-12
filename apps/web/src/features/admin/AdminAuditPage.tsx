import { AUDIT_ACTIONS } from '@taskflow/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AuditEventList } from './AuditEventList'
import { endOfDayIso, startOfDayIso } from './dayRange'
import { useAuditEvents } from './useAdmin'
import './AdminUsersPage.css'

/** Auditnapló: szűrés eseménytípus és időszak szerint, lapozva. */
export function AdminAuditPage() {
  const { t } = useTranslation('admin')
  const [action, setAction] = useState('')
  const [fromDay, setFromDay] = useState('')
  const [toDay, setToDay] = useState('')
  const events = useAuditEvents({
    action: action || undefined,
    from: fromDay ? startOfDayIso(fromDay) : undefined,
    to: toDay ? endOfDayIso(toDay) : undefined,
  })
  const rows = events.data?.pages.flatMap((page) => page.data) ?? []

  return (
    <section className="admin-section" aria-label={t('audit.title')}>
      <h2>{t('audit.title')}</h2>
      <form className="admin-filters" onSubmit={(event) => event.preventDefault()}>
        <label>
          <span>{t('audit.action')}</span>
          <select value={action} onChange={(event) => setAction(event.target.value)}>
            <option value="">{t('audit.allActions')}</option>
            {AUDIT_ACTIONS.map((option) => (
              <option key={option} value={option}>
                {t(`audit.types.${option}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{t('audit.from')}</span>
          <input
            type="date"
            value={fromDay}
            max={toDay || undefined}
            onChange={(event) => setFromDay(event.target.value)}
          />
        </label>
        <label>
          <span>{t('audit.to')}</span>
          <input
            type="date"
            value={toDay}
            min={fromDay || undefined}
            onChange={(event) => setToDay(event.target.value)}
          />
        </label>
      </form>

      {events.isError ? (
        <p role="alert">{t('loadError')}</p>
      ) : events.isPending ? (
        <p role="status" className="admin-empty">
          {t('loading')}
        </p>
      ) : (
        <AuditEventList events={rows} />
      )}

      {events.hasNextPage && (
        <button
          type="button"
          className="secondary-button admin-more"
          disabled={events.isFetchingNextPage}
          onClick={() => events.fetchNextPage()}
        >
          {t('loadMore')}
        </button>
      )}
    </section>
  )
}
