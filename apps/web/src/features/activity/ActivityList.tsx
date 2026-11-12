import { useInfiniteQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { ActivityPage } from '../../api/activity'
import { formatDateTime } from '../../i18n/format'
import { describeActivity } from './describeActivity'
import './ActivityList.css'

type ActivityListProps = {
  queryKey: readonly unknown[]
  fetchPage: (cursor?: string) => Promise<ActivityPage>
}

/** Cursor-lapozású tevékenységlista (a legújabb elöl); a megjelenítendő szöveg a frontenden áll össze. */
export function ActivityList({ queryKey, fetchPage }: ActivityListProps) {
  const { t } = useTranslation(['activity'])
  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
  const entries = query.data?.pages.flatMap((page) => page.data) ?? []

  if (query.isError) return <p role="alert">{t('loadError')}</p>
  if (query.isPending) return <p role="status">{t('loading')}</p>
  if (entries.length === 0) return <p className="activity-empty">{t('empty')}</p>

  return (
    <div className="activity-list-wrap">
      <ul className="activity-list">
        {entries.map((entry) => (
          <li key={entry.id} className="activity-entry">
            <span className="activity-text">
              {describeActivity(entry)}
              {entry.actorType === 'api_key' && (
                <span className="activity-badge">{t('viaApiKey')}</span>
              )}
            </span>
            <time dateTime={entry.createdAt}>{formatDateTime(entry.createdAt)}</time>
          </li>
        ))}
      </ul>
      {query.hasNextPage && (
        <button
          type="button"
          className="secondary-button"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          {t('loadMore')}
        </button>
      )}
    </div>
  )
}
