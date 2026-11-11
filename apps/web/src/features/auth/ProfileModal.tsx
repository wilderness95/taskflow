import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../shared/ui/Modal'
import { authErrorKey } from './authErrors'
import { useAuthActions, useCurrentUser } from './useSession'
import '../../shared/styles/buttons.css'
import '../../shared/styles/form.css'
import './AuthLayout.css'

type ProfileModalProps = {
  onClose: () => void
}

export function ProfileModal({ onClose }: ProfileModalProps) {
  const { t } = useTranslation(['auth', 'common'])
  const user = useCurrentUser()
  const { updateProfile } = useAuthActions()
  const [name, setName] = useState(user?.name ?? '')
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '')

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) {
      return
    }
    updateProfile.mutate({ name, avatarUrl: avatarUrl.trim() || null }, { onSuccess: onClose })
  }

  return (
    <Modal eyebrow={t('auth:profile.eyebrow')} title={t('auth:profile.title')} onClose={onClose}>
      <form className="task-form" onSubmit={handleSubmit}>
        <label>
          {t('auth:fields.name')}
          <input
            type="text"
            required
            maxLength={100}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          {t('auth:profile.avatarUrl')}
          <input
            type="url"
            value={avatarUrl}
            placeholder={t('auth:profile.avatarPlaceholder')}
            onChange={(event) => setAvatarUrl(event.target.value)}
          />
        </label>
        {updateProfile.isError && (
          <p className="auth-form-error" role="alert">
            {t(`auth:errors.${authErrorKey(updateProfile.error)}`)}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            {t('common:cancel')}
          </button>
          <button type="submit" className="primary-button" disabled={updateProfile.isPending}>
            {t('common:save')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
