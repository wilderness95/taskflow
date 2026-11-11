import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../shared/ui/Modal'

type InviteModalProps = {
  onClose: () => void
}

export function InviteModal({ onClose }: InviteModalProps) {
  const { t } = useTranslation(['workspace', 'common'])
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
      eyebrow={t('workspace:invite.eyebrow')}
      title={t('workspace:invite.title')}
      onClose={onClose}
      cardClassName="invite-modal-card"
    >
      <form className="invite-form" onSubmit={handleSubmit}>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={t('workspace:invite.emailPlaceholder')}
          aria-label={t('workspace:invite.emailAria')}
        />

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            {t('common:cancel')}
          </button>
          <button type="submit" className="primary-button">
            {t('workspace:invite.submit')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
