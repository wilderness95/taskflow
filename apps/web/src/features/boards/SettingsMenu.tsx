import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useDismiss } from '../../shared/hooks/useDismiss'
import { Icon } from '../../shared/ui/Icon'
import { ProfileModal } from '../auth/ProfileModal'
import { ShortcutsModal } from './ShortcutsModal'
import '../../shared/styles/menu.css'

type SettingsMenuProps = { workspaceId?: string }

type Opened = 'profile' | 'shortcuts' | null

/** A fogaskerék menü: profil, API kulcsok, munkaterület-tagok és billentyűparancsok. */
export function SettingsMenu({ workspaceId }: SettingsMenuProps) {
  const { t } = useTranslation(['board', 'auth', 'shortcuts', 'workspace'])
  const navigate = useNavigate()
  const [isOpen, setIsOpen] = useState(false)
  const [opened, setOpened] = useState<Opened>(null)
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, isOpen, () => setIsOpen(false))

  const choose = (action: () => void) => () => {
    setIsOpen(false)
    action()
  }

  return (
    <div className="settings-menu" ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        className="icon-button"
        aria-label={t('board:settings')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Icon name="settings" size={18} />
      </button>
      {isOpen && (
        <div className="menu-panel" role="menu">
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={choose(() => setOpened('profile'))}
          >
            {t('auth:menu.profile')}
          </button>
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={choose(() => navigate('/settings/api-keys'))}
          >
            {t('auth:menu.apiKeys')}
          </button>
          {workspaceId && (
            <button
              type="button"
              role="menuitem"
              className="menu-item"
              onClick={choose(() => navigate(`/w/${workspaceId}/members`))}
            >
              {t('board:settingsMenu.workspaceMembers')}
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="menu-item"
            onClick={choose(() => setOpened('shortcuts'))}
          >
            {t('shortcuts:open')}
          </button>
        </div>
      )}
      {opened === 'profile' && <ProfileModal onClose={() => setOpened(null)} />}
      {opened === 'shortcuts' && <ShortcutsModal onClose={() => setOpened(null)} />}
    </div>
  )
}
