import { ADMIN_USER_STATUSES } from '@taskflow/shared'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AdminUserList } from './AdminUserList'
import { UserDetailModal } from './UserDetailModal'
import { useAdminUsers } from './useAdmin'
import { useDebouncedValue } from './useDebouncedValue'
import './AdminUsersPage.css'

type Status = (typeof ADMIN_USER_STATUSES)[number]

/** Felhasználók: keresés, szűrés állapot szerint, és az adatlap megnyitása. */
export function AdminUsersPage() {
  const { t } = useTranslation(['admin', 'common'])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<Status>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const q = useDebouncedValue(search.trim()) || undefined
  const users = useAdminUsers({ q, status })
  const rows = users.data?.pages.flatMap((page) => page.data) ?? []

  return (
    <section className="admin-section" aria-label={t('admin:users.title')}>
      <h2>{t('admin:users.title')}</h2>
      <form className="admin-filters" role="search" onSubmit={(event) => event.preventDefault()}>
        <label>
          <span>{t('admin:users.search')}</span>
          <input
            type="search"
            value={search}
            placeholder={t('admin:users.searchPlaceholder')}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label>
          <span>{t('admin:users.status')}</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as Status)}>
            {ADMIN_USER_STATUSES.map((option) => (
              <option key={option} value={option}>
                {t(`admin:users.statuses.${option}`)}
              </option>
            ))}
          </select>
        </label>
      </form>

      {users.isError ? (
        <p role="alert">{t('admin:loadError')}</p>
      ) : users.isPending ? (
        <p role="status" className="admin-empty">
          {t('admin:loading')}
        </p>
      ) : (
        <AdminUserList users={rows} onSelect={setSelectedId} />
      )}

      {users.hasNextPage && (
        <button
          type="button"
          className="secondary-button admin-more"
          disabled={users.isFetchingNextPage}
          onClick={() => users.fetchNextPage()}
        >
          {t('admin:loadMore')}
        </button>
      )}

      {selectedId && <UserDetailModal userId={selectedId} onClose={() => setSelectedId(null)} />}
    </section>
  )
}
