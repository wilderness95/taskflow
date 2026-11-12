import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { getLastWorkspace } from '../../shared/lib/lastWorkspace'
import { useWorkspaces } from '../workspaces/useWorkspaces'

/** Gyors ugrás a felhasználói menüből: az aktuális munkaterület táblái és listái, majd a többi munkaterület. */
export function UserMenuNav({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const { data: workspaces = [] } = useWorkspaces()
  if (workspaces.length === 0) return null

  const lastId = getLastWorkspace()
  const current = workspaces.find((w) => w.id === lastId) ?? workspaces[0]!
  const go = (path: string) => {
    onNavigate()
    navigate(path)
  }

  return (
    <nav className="user-menu-nav" aria-label={t('menu.navAria')}>
      <button type="button" className="menu-item" onClick={() => go(`/w/${current.id}`)}>
        {t('menu.boards')}
      </button>
      <button type="button" className="menu-item" onClick={() => go(`/w/${current.id}/lists`)}>
        {t('menu.lists')}
      </button>
      {workspaces.length > 1 && (
        <>
          <span className="user-menu-label">{t('menu.workspaces')}</span>
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              type="button"
              className={`menu-item${workspace.id === current.id ? ' selected' : ''}`}
              aria-current={workspace.id === current.id ? 'true' : undefined}
              onClick={() => go(`/w/${workspace.id}`)}
            >
              {workspace.name}
            </button>
          ))}
        </>
      )}
    </nav>
  )
}
