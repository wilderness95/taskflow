import { useRef, useState } from 'react'
import { useDismiss } from '../../shared/hooks/useDismiss'
import { classNames } from '../../shared/lib/classNames'
import '../../shared/styles/menu.css'
import './WorkspaceSwitcher.css'

// Átmeneti, beégetett lista: az M3 mérföldkőben a szerverről jön.
const WORKSPACE_OPTIONS = ['Web App Fejlesztés', 'Marketing', 'CRM']

export function WorkspaceSwitcher() {
  const [selected, setSelected] = useState(WORKSPACE_OPTIONS[0])
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useDismiss(ref, isOpen, () => setIsOpen(false))

  return (
    <div className="workspace-switcher-wrap" ref={ref}>
      <button
        type="button"
        className="workspace-switcher"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{selected}</span>
        <span className="caret">⌄</span>
      </button>
      {isOpen && (
        <div className="menu-panel workspace-panel">
          {WORKSPACE_OPTIONS.map((workspace) => (
            <button
              key={workspace}
              type="button"
              className={classNames('menu-item', selected === workspace && 'selected')}
              onClick={() => {
                setSelected(workspace)
                setIsOpen(false)
              }}
            >
              {workspace}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
