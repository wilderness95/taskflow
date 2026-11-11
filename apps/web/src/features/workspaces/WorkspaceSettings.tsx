import { workspaceRoleCan, type WorkspaceDto } from '@taskflow/shared'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { ConfirmModal } from '../../shared/ui/ConfirmModal'
import type { useWorkspaceMembers } from './useWorkspaceMembers'

type WorkspaceSettingsProps = {
  workspace: WorkspaceDto
  actions: ReturnType<typeof useWorkspaceMembers>
}

/** Átnevezés (owner, admin) és törlés (owner). */
export function WorkspaceSettings({ workspace, actions }: WorkspaceSettingsProps) {
  const { t } = useTranslation('workspace')
  const navigate = useNavigate()
  const [name, setName] = useState(workspace.name)
  const [isConfirming, setIsConfirming] = useState(false)
  const canRename = workspaceRoleCan(workspace.role, 'workspace:update')
  const canDelete = workspaceRoleCan(workspace.role, 'workspace:delete')

  if (!canRename && !canDelete) {
    return null
  }

  const handleRename = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim() && name !== workspace.name) {
      actions.rename.mutate(name)
    }
  }

  return (
    <section aria-label={t('membersPage.settings.title')}>
      <h2>{t('membersPage.settings.title')}</h2>
      {canRename && (
        <form className="members-invite-form" onSubmit={handleRename}>
          <input
            type="text"
            required
            maxLength={100}
            value={name}
            aria-label={t('fields.name')}
            onChange={(event) => setName(event.target.value)}
          />
          <button type="submit" className="secondary-button" disabled={actions.rename.isPending}>
            {t('membersPage.settings.rename')}
          </button>
        </form>
      )}
      {canDelete && (
        <>
          <button type="button" className="secondary-button" onClick={() => setIsConfirming(true)}>
            {t('membersPage.settings.delete')}
          </button>
          <small className="workspace-empty"> {t('membersPage.settings.deleteHint')}</small>
        </>
      )}
      {isConfirming && (
        <ConfirmModal
          eyebrow={t('membersPage.confirmDelete.eyebrow')}
          title={t('membersPage.confirmDelete.title')}
          message={t('membersPage.confirmDelete.message')}
          confirmLabel={t('membersPage.confirmDelete.confirm')}
          onConfirm={() => {
            setIsConfirming(false)
            actions.deleteWorkspace.mutate(undefined, {
              onSuccess: () => navigate('/', { replace: true }),
            })
          }}
          onClose={() => setIsConfirming(false)}
        />
      )}
    </section>
  )
}
