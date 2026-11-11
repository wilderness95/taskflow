import { useTranslation } from 'react-i18next'
import { WorkspaceSwitcher } from '../workspaces/WorkspaceSwitcher'
import '../../shared/styles/base.css'
import './Topbar.css'

type TopbarProps = {
  searchQuery: string
  onSearchChange: (query: string) => void
  totalTasks: number
}

export function Topbar({ searchQuery, onSearchChange, totalTasks }: TopbarProps) {
  const { t } = useTranslation(['board', 'common'])

  return (
    <header className="topbar">
      <div className="brand-wrap">
        <div className="brand-badge">T</div>
        <span className="brand-name">{t('common:appName')}</span>
      </div>

      <WorkspaceSwitcher />

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
        <div className="avatar">A</div>
      </div>
    </header>
  )
}
