import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Modal } from '../../shared/ui/Modal'
import { useCreateList } from './useLists'
import '../../shared/styles/buttons.css'
import '../../shared/styles/form.css'

export function CreateListModal({
  workspaceId,
  onClose,
}: {
  workspaceId: string
  onClose: () => void
}) {
  const { t } = useTranslation(['lists', 'common'])
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const create = useCreateList(workspaceId)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    create.mutate(title.trim(), {
      onSuccess: (list) => {
        onClose()
        navigate(`/l/${list.id}`)
      },
    })
  }

  return (
    <Modal eyebrow={t('lists:create.eyebrow')} title={t('lists:create.title')} onClose={onClose}>
      <form className="task-form" onSubmit={handleSubmit}>
        <label>
          {t('lists:create.titleLabel')}
          <input
            type="text"
            required
            maxLength={200}
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            {t('common:cancel')}
          </button>
          <button type="submit" className="primary-button" disabled={create.isPending}>
            {t('lists:create.submit')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
