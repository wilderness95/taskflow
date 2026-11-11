import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Modal } from '../../shared/ui/Modal'
import { authErrorKey } from '../auth/authErrors'
import { useCreateWorkspace } from './useWorkspaces'
import '../../shared/styles/buttons.css'
import '../../shared/styles/form.css'
import '../auth/AuthLayout.css'

type CreateWorkspaceModalProps = {
  onClose: () => void
}

export function CreateWorkspaceModal({ onClose }: CreateWorkspaceModalProps) {
  const { t } = useTranslation(['workspace', 'common', 'auth'])
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const create = useCreateWorkspace()

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    create.mutate(name, {
      onSuccess: (workspace) => {
        onClose()
        navigate(`/w/${workspace.id}`)
      },
    })
  }

  return (
    <Modal
      eyebrow={t('workspace:createWorkspace.eyebrow')}
      title={t('workspace:createWorkspace.title')}
      onClose={onClose}
    >
      <form className="task-form" onSubmit={handleSubmit}>
        <label>
          {t('workspace:fields.name')}
          <input
            type="text"
            required
            maxLength={100}
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        {create.isError && (
          <p className="auth-form-error" role="alert">
            {t(`auth:errors.${authErrorKey(create.error)}`)}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            {t('common:cancel')}
          </button>
          <button type="submit" className="primary-button" disabled={create.isPending}>
            {t('workspace:createWorkspace.submit')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
