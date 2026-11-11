import { useMutation } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import * as api from '../../api/auth'
import { authErrorKey } from '../auth/authErrors'
import { Modal } from '../../shared/ui/Modal'
import '../../shared/styles/buttons.css'
import './InviteModal.css'

type InviteModalProps = {
  onClose: () => void
}

export function InviteModal({ onClose }: InviteModalProps) {
  const { t } = useTranslation(['workspace', 'common', 'auth'])
  const [email, setEmail] = useState('')
  const invite = useMutation({
    meta: { handlesErrors: true },
    mutationFn: (value: string) => api.createInvitation({ email: value }),
    onSuccess: () => setEmail(''),
  })

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!email.trim()) {
      return
    }

    // M2: regisztrációs meghívó (csak admin); a munkaterületi meghívás az M3-ban jön.
    invite.mutate(email)
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

        {invite.isSuccess && <p role="status">{t('workspace:invite.sent')}</p>}
        {invite.isError && <p role="alert">{t(`auth:errors.${authErrorKey(invite.error)}`)}</p>}

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            {t('common:cancel')}
          </button>
          <button type="submit" className="primary-button" disabled={invite.isPending}>
            {t('workspace:invite.submit')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
