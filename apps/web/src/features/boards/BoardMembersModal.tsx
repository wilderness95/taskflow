import { BOARD_ROLES, type BoardRole } from '@taskflow/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as boardsApi from '../../api/boards'
import * as workspacesApi from '../../api/workspaces'
import { Modal } from '../../shared/ui/Modal'
import { authErrorKey } from '../auth/authErrors'
import '../../shared/styles/buttons.css'
import '../../shared/styles/form.css'
import '../auth/AuthLayout.css'
import './BoardMembersModal.css'

type BoardMembersModalProps = {
  boardId: string
  workspaceId: string
  /** `board:manage_members` jog: csak ekkor szerkeszthető a lista. */
  canManage: boolean
  onClose: () => void
}

/** A tábla explicit tagjai (privát táblák hozzáférése); a munkaterület tagjai közül választhatók. */
export function BoardMembersModal({
  boardId,
  workspaceId,
  canManage,
  onClose,
}: BoardMembersModalProps) {
  const { t } = useTranslation(['board', 'workspace', 'common', 'auth'])
  const queryClient = useQueryClient()
  const key = ['board-members', boardId] as const
  const [newUserId, setNewUserId] = useState('')
  const [newRole, setNewRole] = useState<BoardRole>('editor')

  const members = useQuery({ queryKey: key, queryFn: () => boardsApi.listBoardMembers(boardId) })
  const workspaceMembers = useQuery({
    queryKey: ['workspace-members', workspaceId],
    queryFn: () => workspacesApi.listMembers(workspaceId),
    enabled: canManage,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: key })
  const save = useMutation({
    meta: { handlesErrors: true },
    mutationFn: (vars: { userId: string; role: BoardRole }) =>
      boardsApi.setBoardMember(boardId, vars.userId, { role: vars.role }),
    onSuccess: refresh,
  })
  const remove = useMutation({
    meta: { handlesErrors: true },
    mutationFn: (userId: string) => boardsApi.removeBoardMember(boardId, userId),
    onSuccess: refresh,
  })

  const explicitIds = new Set((members.data ?? []).map((member) => member.userId))
  const candidates = (workspaceMembers.data ?? []).filter(
    (member) => !explicitIds.has(member.userId),
  )
  const error = save.error ?? remove.error

  return (
    <Modal
      eyebrow={t('board:members.eyebrow')}
      title={t('board:members.title')}
      onClose={onClose}
      cardClassName="modal-card board-members-card"
    >
      <p className="board-members-hint">{t('board:members.hint')}</p>

      <ul className="board-members-list">
        {(members.data ?? []).map((member) => (
          <li key={member.userId}>
            <span className="board-members-identity">
              <strong>{member.name}</strong>
              <small>{member.email}</small>
            </span>
            {canManage ? (
              <>
                <select
                  aria-label={t('board:members.roleAria', { name: member.name })}
                  value={member.role}
                  onChange={(event) =>
                    save.mutate({ userId: member.userId, role: event.target.value as BoardRole })
                  }
                >
                  {BOARD_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {t(`board:members.roles.${role}`)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => remove.mutate(member.userId)}
                >
                  {t('board:members.remove')}
                </button>
              </>
            ) : (
              <span>{t(`board:members.roles.${member.role}`)}</span>
            )}
          </li>
        ))}
        {members.data?.length === 0 && <li>{t('board:members.empty')}</li>}
      </ul>

      {canManage && (
        <form
          className="board-members-add"
          onSubmit={(event) => {
            event.preventDefault()
            if (newUserId) {
              save.mutate(
                { userId: newUserId, role: newRole },
                { onSuccess: () => setNewUserId('') },
              )
            }
          }}
        >
          <select
            aria-label={t('board:members.pickAria')}
            value={newUserId}
            onChange={(event) => setNewUserId(event.target.value)}
          >
            <option value="">{t('board:members.pick')}</option>
            {candidates.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name} ({member.email})
              </option>
            ))}
          </select>
          <select
            aria-label={t('board:members.newRoleAria')}
            value={newRole}
            onChange={(event) => setNewRole(event.target.value as BoardRole)}
          >
            {BOARD_ROLES.map((role) => (
              <option key={role} value={role}>
                {t(`board:members.roles.${role}`)}
              </option>
            ))}
          </select>
          <button type="submit" className="primary-button" disabled={!newUserId || save.isPending}>
            {t('board:members.add')}
          </button>
        </form>
      )}

      {error && (
        <p className="auth-form-error" role="alert">
          {t(`auth:errors.${authErrorKey(error)}`)}
        </p>
      )}

      <div className="modal-actions">
        <button type="button" className="secondary-button" onClick={onClose}>
          {t('common:close')}
        </button>
      </div>
    </Modal>
  )
}
