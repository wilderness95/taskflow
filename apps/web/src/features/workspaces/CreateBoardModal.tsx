import { BOARD_VISIBILITIES, type BoardVisibility } from '@taskflow/shared'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Modal } from '../../shared/ui/Modal'
import { authErrorKey } from '../auth/authErrors'
import { useCreateBoard } from './useWorkspaces'
import '../../shared/styles/buttons.css'
import '../../shared/styles/form.css'
import '../auth/AuthLayout.css'

type CreateBoardModalProps = {
  workspaceId: string
  onClose: () => void
}

export function CreateBoardModal({ workspaceId, onClose }: CreateBoardModalProps) {
  const { t } = useTranslation(['workspace', 'board', 'common', 'auth'])
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [visibility, setVisibility] = useState<BoardVisibility>('workspace')
  const create = useCreateBoard(workspaceId)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (!title.trim()) return
    create.mutate(
      { title, visibility },
      {
        onSuccess: (board) => {
          onClose()
          navigate(`/b/${board.id}`)
        },
      },
    )
  }

  return (
    <Modal
      eyebrow={t('workspace:createBoard.eyebrow')}
      title={t('workspace:createBoard.title')}
      onClose={onClose}
    >
      <form className="task-form" onSubmit={handleSubmit}>
        <label>
          {t('workspace:createBoard.titleLabel')}
          <input
            type="text"
            required
            maxLength={200}
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label>
          {t('workspace:createBoard.visibility')}
          <select
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as BoardVisibility)}
          >
            {BOARD_VISIBILITIES.map((value) => (
              <option key={value} value={value}>
                {t(`board:visibility.${value}.label`)} –{' '}
                {t(`board:visibility.${value}.description`)}
              </option>
            ))}
          </select>
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
            {t('workspace:createBoard.submit')}
          </button>
        </div>
      </form>
    </Modal>
  )
}
