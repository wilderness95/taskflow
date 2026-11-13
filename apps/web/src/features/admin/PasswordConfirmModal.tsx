import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../../shared/ui/Modal'
import { adminErrorKey } from './adminErrors'

type PasswordConfirmModalProps = {
  eyebrow: string
  title: string
  message: string
  confirmLabel: string
  pending: boolean
  /** A sikertelen kísérlet hibája (pl. hibás jelszó); az ablak nyitva marad. */
  error: unknown
  onConfirm: (password: string) => void
  onClose: () => void
}

/** Megerősítés a végrehajtó saját jelszavával (step-up) az érzékeny adminműveleteknél. */
export function PasswordConfirmModal({
  eyebrow,
  title,
  message,
  confirmLabel,
  pending,
  error,
  onConfirm,
  onClose,
}: PasswordConfirmModalProps) {
  const { t } = useTranslation(['admin', 'common'])
  const [password, setPassword] = useState('')

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (password) onConfirm(password)
  }

  return (
    <Modal eyebrow={eyebrow} title={title} onClose={onClose}>
      <form className="task-form" onSubmit={submit}>
        <p className="confirm-copy">{message}</p>
        <label>
          {t('admin:stepUp.password')}
          <input
            type="password"
            autoComplete="current-password"
            required
            autoFocus
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <small>{t('admin:stepUp.hint')}</small>
        {Boolean(error) && (
          <p className="auth-form-error" role="alert">
            {t(`admin:errors.${adminErrorKey(error)}`)}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            {t('common:cancel')}
          </button>
          <button type="submit" className="primary-button" disabled={pending || !password}>
            {confirmLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}
