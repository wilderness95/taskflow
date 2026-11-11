import { useRef, useState } from 'react'
import { useDismiss } from '../../shared/hooks/useDismiss'
import { classNames } from '../../shared/lib/classNames'
import { VISIBILITIES, VISIBILITY_OPTIONS } from './boardOptions'
import type { Visibility } from './types'

type VisibilityMenuProps = {
  visibility: Visibility
  onChange: (visibility: Visibility) => void
}

export function VisibilityMenu({ visibility, onChange }: VisibilityMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = VISIBILITY_OPTIONS[visibility]

  useDismiss(ref, isOpen, () => setIsOpen(false))

  return (
    <div className="visibility-badge-wrap" ref={ref}>
      <button type="button" className="visibility-badge" onClick={() => setIsOpen((open) => !open)}>
        <span className="visibility-icon">{current.icon}</span>
        <span>{current.label}</span>
      </button>
      {isOpen && (
        <div className="menu-panel visibility-panel">
          {VISIBILITIES.map((value) => {
            const option = VISIBILITY_OPTIONS[value]

            return (
              <button
                key={value}
                type="button"
                className={classNames('menu-item', visibility === value && 'selected')}
                onClick={() => {
                  onChange(value)
                  setIsOpen(false)
                }}
              >
                <span>{option.icon}</span>
                <span className="menu-copy">
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
