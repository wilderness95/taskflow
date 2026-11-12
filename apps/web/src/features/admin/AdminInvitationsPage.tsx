import { ADMIN_INVITATION_STATUSES, type AdminInvitationDto } from '@taskflow/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdminInvitationList } from './AdminInvitationList'
import { AdminInviteForm } from './AdminInviteForm'
import { useAdminInvitations, useInvitationActions } from './useAdmin'
import './AdminUsersPage.css'

type Status = AdminInvitationDto['status'] | ''

/** Meghívók: küldés, állapot szerinti lista, újraküldés és visszavonás. */
export function AdminInvitationsPage() {
  const { t } = useTranslation('admin')
  const [status, setStatus] = useState<Status>('')
  const actions = useInvitationActions()
  const invitations = useAdminInvitations({ status: status || undefined })
  const rows = invitations.data?.pages.flatMap((page) => page.data) ?? []

  return (
    <>
      <section className="admin-section" aria-label={t('invitations.new')}>
        <h2>{t('invitations.new')}</h2>
        <AdminInviteForm actions={actions} />
      </section>

      <section className="admin-section" aria-label={t('invitations.title')}>
        <h2>{t('invitations.title')}</h2>
        <form className="admin-filters" onSubmit={(event) => event.preventDefault()}>
          <label>
            <span>{t('invitations.status')}</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as Status)}>
              <option value="">{t('invitations.allStatuses')}</option>
              {ADMIN_INVITATION_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {t(`invitations.statuses.${option}`)}
                </option>
              ))}
            </select>
          </label>
        </form>

        {invitations.isError ? (
          <p role="alert">{t('loadError')}</p>
        ) : invitations.isPending ? (
          <p role="status" className="admin-empty">
            {t('loading')}
          </p>
        ) : (
          <AdminInvitationList invitations={rows} actions={actions} />
        )}

        {invitations.hasNextPage && (
          <button
            type="button"
            className="secondary-button admin-more"
            disabled={invitations.isFetchingNextPage}
            onClick={() => invitations.fetchNextPage()}
          >
            {t('loadMore')}
          </button>
        )}
      </section>
    </>
  )
}
