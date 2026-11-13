import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useDismiss } from '../../shared/hooks/useDismiss'
import { classNames } from '../../shared/lib/classNames'
import { Icon } from '../../shared/ui/Icon'
import { CreateWorkspaceModal } from './CreateWorkspaceModal'
import { useWorkspaces } from './useWorkspaces'
import '../../shared/styles/menu.css'
import './WorkspaceSwitcher.css'

type WorkspaceSwitcherProps = {
  /** A jelenleg megnyitott munkaterület. */
  currentWorkspaceId?: string
}

export function WorkspaceSwitcher({ currentWorkspaceId }: WorkspaceSwitcherProps) {
  const { t } = useTranslation('workspace')
  const navigate = useNavigate()
  const { data: workspaces = [] } = useWorkspaces()
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useDismiss(ref, isOpen, () => setIsOpen(false))

  const current = workspaces.find((workspace) => workspace.id === currentWorkspaceId)

  return (
    <div className="workspace-switcher-wrap" ref={ref}>
      <button
        type="button"
        className="workspace-switcher"
        aria-label={t('switcher.aria')}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{current?.name ?? t('switcher.choose')}</span>
        <Icon name="chevron-down" size={14} className="caret" />
      </button>
      {isOpen && (
        <div className="menu-panel workspace-panel">
          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              type="button"
              className={classNames('menu-item', workspace.id === currentWorkspaceId && 'selected')}
              onClick={() => {
                setIsOpen(false)
                navigate(`/w/${workspace.id}`)
              }}
            >
              {workspace.name}
            </button>
          ))}
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              setIsOpen(false)
              setIsCreating(true)
            }}
          >
            {t('switcher.create')}
          </button>
        </div>
      )}
      {isCreating && <CreateWorkspaceModal onClose={() => setIsCreating(false)} />}
    </div>
  )
}
