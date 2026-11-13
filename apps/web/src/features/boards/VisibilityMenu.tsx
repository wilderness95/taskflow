import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDismiss } from '../../shared/hooks/useDismiss'
import { classNames } from '../../shared/lib/classNames'
import { Icon } from '../../shared/ui/Icon'
import { VISIBILITIES, VISIBILITY_ICONS } from './boardOptions'
import type { Visibility } from './types'
import '../../shared/styles/menu.css'
import './VisibilityMenu.css'

type VisibilityMenuProps = {
  visibility: Visibility
  onChange: (visibility: Visibility) => void
  readOnly?: boolean
}

export function VisibilityMenu({ visibility, onChange, readOnly = false }: VisibilityMenuProps) {
  const { t } = useTranslation('board')
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useDismiss(ref, isOpen, () => setIsOpen(false))

  if (readOnly) {
    return (
      <div className="visibility-badge-wrap">
        <span className="visibility-badge">
          <span className="visibility-icon">
            <Icon name={VISIBILITY_ICONS[visibility]} size={15} />
          </span>
          <span>{t(`visibility.${visibility}.label`)}</span>
        </span>
      </div>
    )
  }

  return (
    <div className="visibility-badge-wrap" ref={ref}>
      <button type="button" className="visibility-badge" onClick={() => setIsOpen((open) => !open)}>
        <span className="visibility-icon">
          <Icon name={VISIBILITY_ICONS[visibility]} size={15} />
        </span>
        <span>{t(`visibility.${visibility}.label`)}</span>
      </button>
      {isOpen && (
        <div className="menu-panel visibility-panel">
          {VISIBILITIES.map((value) => (
            <button
              key={value}
              type="button"
              className={classNames('menu-item', visibility === value && 'selected')}
              onClick={() => {
                onChange(value)
                setIsOpen(false)
              }}
            >
              <span className="visibility-icon">
                <Icon name={VISIBILITY_ICONS[value]} size={16} />
              </span>
              <span className="menu-copy">
                <strong>{t(`visibility.${value}.label`)}</strong>
                <small>{t(`visibility.${value}.description`)}</small>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
