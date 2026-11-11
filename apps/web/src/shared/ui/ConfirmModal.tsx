import { Modal } from './Modal'

type ConfirmModalProps = {
  eyebrow: string
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onClose: () => void
}

export function ConfirmModal({
  eyebrow,
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
}: ConfirmModalProps) {
  return (
    <Modal eyebrow={eyebrow} title={title} onClose={onClose}>
      <p className="confirm-copy">{message}</p>

      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onClose}>
          Mégse
        </button>
        <button type="button" className="primary-button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
