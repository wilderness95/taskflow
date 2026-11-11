import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { UserMenu } from '../auth/UserMenu'
import { WorkspaceSwitcher } from '../workspaces/WorkspaceSwitcher'
import '../../shared/styles/base.css'
import './Topbar.css'

type TopbarProps = {
  searchQuery: string
  onSearchChange: (query: string) => void
  totalTasks: number
  workspaceId?: string
}

export function Topbar({ searchQuery, onSearchChange, totalTasks, workspaceId }: TopbarProps) {
  const { t } = useTranslation(['board', 'common'])

  return (
    <header className="topbar">
      <Link to="/" className="brand-wrap">
        <div className="brand-badge">T</div>
        <span className="brand-name">{t('common:appName')}</span>
      </Link>

      <WorkspaceSwitcher currentWorkspaceId={workspaceId} />

      <div className="search-box">
        <span className="search-icon">⌕</span>
        <input
          type="text"
          placeholder={t('board:search.placeholder')}
          aria-label={t('board:search.aria')}
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="topbar-actions">
        <div className="stat-pill">{t('board:taskCount', { count: totalTasks })}</div>
        <button type="button" className="icon-button" aria-label={t('board:notifications')}>
          ◔
        </button>
        <button type="button" className="icon-button" aria-label={t('board:settings')}>
          ⚙
        </button>
        <UserMenu />
      </div>
    </header>
  )
}
