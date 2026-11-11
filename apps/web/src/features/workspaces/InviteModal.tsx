import { useState, type FormEvent } from 'react'
import { Modal } from '../../shared/ui/Modal'

type InviteModalProps = {
  onClose: () => void
}

export function InviteModal({ onClose }: InviteModalProps) {
  const [email, setEmail] = useState('')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim()) {
      return
    }

    // TODO(M3): meghívó küldése az API-n keresztül.
    onClose()
  }

  return (
    <Modal
      eyebrow="Meghívás"
      title="Tag hozzáadása"
      onClose={onClose}
      cardClassName="invite-modal-card"
    >
      <form className="invite-form" onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="email@pelda.hu"
          aria-label="Email cím"
        />

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Mégse
          </button>
          <button type="submit" className="primary-button">
            Meghívás
          </button>
        </div>
      </form>
    </Modal>
  )
}
