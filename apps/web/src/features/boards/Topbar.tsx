import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { NotificationBell } from '../notifications/NotificationBell'
import { UserMenu } from '../auth/UserMenu'
import { SettingsMenu } from './SettingsMenu'
import { VoiceButton } from '../voice/VoiceButton'
import { useVoiceAvailable } from '../voice/useVoiceAvailable'
import { WorkspaceSwitcher } from '../workspaces/WorkspaceSwitcher'
import '../../shared/styles/base.css'
import './Topbar.css'

type TopbarProps = {
  searchQuery: string
  onSearchChange: (query: string) => void
  totalTasks: number
  workspaceId?: string
  /** A `/` gyorsbillentyű ide viszi a fókuszt. */
  searchInputRef?: RefObject<HTMLInputElement | null>
  /** A nézett tábla; ha megvan és a hangasszisztens be van állítva, megjelenik a mikrofon gomb. */
  boardId?: string
}

export function Topbar({
  searchQuery,
  onSearchChange,
  totalTasks,
  workspaceId,
  searchInputRef,
  boardId,
}: TopbarProps) {
  const { t } = useTranslation(['board', 'common'])
  const voiceAvailable = useVoiceAvailable()

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
          ref={searchInputRef}
          aria-keyshortcuts="/"
          type="text"
          placeholder={t('board:search.placeholder')}
          aria-label={t('board:search.aria')}
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="topbar-actions">
        <div className="stat-pill">{t('board:taskCount', { count: totalTasks })}</div>
        {voiceAvailable && boardId && <VoiceButton key={boardId} boardId={boardId} />}
        <NotificationBell />
        <SettingsMenu workspaceId={workspaceId} />
        <UserMenu />
      </div>
    </header>
  )
}
