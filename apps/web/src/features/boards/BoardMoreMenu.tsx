import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDismiss } from '../../shared/hooks/useDismiss'
import { Icon } from '../../shared/ui/Icon'
import '../../shared/styles/buttons.css'
import '../../shared/styles/menu.css'
import './BoardMoreMenu.css'

export type MoreMenuItem = { key: string; label: string; onSelect: () => void; danger?: boolean }

type BoardMoreMenuProps = { items: MoreMenuItem[] }

/** A tábla másodlagos műveleteinek legördülő menüje (Tagok, Tevékenység, Címkék, ...). */
export function BoardMoreMenu({ items }: BoardMoreMenuProps) {
  const { t } = useTranslation('board')
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useDismiss(ref, isOpen, () => setIsOpen(false))

  return (
    <div className="more-menu-wrap" ref={ref}>
      <button
        type="button"
        className="secondary-button more-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{t('more.open')}</span>
        <Icon name="chevron-down" size={14} />
      </button>
      {isOpen && (
        <div className="menu-panel more-menu-panel" role="menu">
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className={item.danger ? 'menu-item more-menu-danger' : 'menu-item'}
              onClick={() => {
                setIsOpen(false)
                item.onSelect()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
