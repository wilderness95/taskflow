import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { UserMenu } from '../auth/UserMenu'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import '../../shared/styles/base.css'
import '../boards/Topbar.css'
import './WorkspacePage.css'

/** A munkaterület-szintű oldalak (táblalista, tagok) egyszerű fejléce. */
export function WorkspaceTopbar({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation('common')

  return (
    <header className="topbar workspace-topbar">
      <Link to="/" className="brand-wrap">
        <div className="brand-badge">T</div>
        <span className="brand-name">{t('appName')}</span>
      </Link>
      <WorkspaceSwitcher currentWorkspaceId={workspaceId} />
      <div className="topbar-actions">
        <UserMenu />
      </div>
    </header>
  )
}
