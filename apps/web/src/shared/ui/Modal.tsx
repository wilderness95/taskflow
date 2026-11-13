import {
  useEffect,
  useId,
  useRef,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from './Icon'
import '../styles/base.css'
import '../styles/buttons.css'
import './Modal.css'

type ModalProps = {
  eyebrow: string
  title: string
  onClose: () => void
  cardClassName?: string
  children: ReactNode
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export function Modal({
  eyebrow,
  title,
  onClose,
  cardClassName = 'modal-card',
  children,
}: ModalProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const card = useRef<HTMLDivElement>(null)

  // Megnyitáskor a párbeszédablakra kerül a fókusz, bezáráskor vissza oda, ahonnan nyílt.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    card.current?.focus()
    return () => previous?.focus()
  }, [])

  // Escape bezárja; a Tab az ablakon belül marad (fókuszcsapda).
  const handleKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab' || !card.current) return
    const items = [...card.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    const first = items[0]
    const last = items[items.length - 1]
    if (!first || !last) return
    if (
      event.shiftKey &&
      (document.activeElement === first || document.activeElement === card.current)
    ) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        ref={card}
        className={cardClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="modal-header">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2 id={titleId}>{title}</h2>
          </div>
          <button type="button" className="close-button" onClick={onClose} aria-label={t('close')}>
            <Icon name="close" size={18} />
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}
