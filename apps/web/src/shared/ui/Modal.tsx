import type { ReactNode } from 'react'

type ModalProps = {
  eyebrow: string
  title: string
  onClose: () => void
  cardClassName?: string
  children: ReactNode
}

export function Modal({
  eyebrow,
  title,
  onClose,
  cardClassName = 'modal-card',
  children,
}: ModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className={cardClassName} onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <button type="button" className="close-button" onClick={onClose} aria-label="Bezárás">
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  )
}
