import {
  canManageMember,
  WORKSPACE_ROLES,
  type MemberDto,
  type WorkspaceDto,
  type WorkspaceRole,
} from '@taskflow/shared'
import { useTranslation } from 'react-i18next'
import { useCurrentUser } from '../auth/useSession'
import type { useWorkspaceMembers } from './useWorkspaceMembers'

type MemberListProps = {
  workspace: WorkspaceDto
  members: MemberDto[]
  actions: ReturnType<typeof useWorkspaceMembers>
}

/** A tagok listája; a szerepkör-választó csak azt kínálja, amit a policy (`canManageMember`) megenged. */
export function MemberList({ workspace, members, actions }: MemberListProps) {
  const { t } = useTranslation('workspace')
  const me = useCurrentUser()

  const assignable = (target: MemberDto): WorkspaceRole[] =>
    WORKSPACE_ROLES.filter((role) => canManageMember(workspace.role, target.role, role))

  return (
    <section aria-label={t('membersPage.members')}>
      <h2>{t('membersPage.members')}</h2>
      <ul className="members-list">
        {members.map((member) => {
          const isMe = member.userId === me?.id
          const roles = assignable(member)
          const canRemove = isMe || canManageMember(workspace.role, member.role, null)

          return (
            <li key={member.userId}>
              <span className="members-identity">
                <strong>
                  {member.name} {isMe && t('membersPage.you')}
                </strong>
                <small>{member.email}</small>
              </span>
              {roles.length > 0 ? (
                <select
                  aria-label={t('membersPage.roleAria', { name: member.name })}
                  value={member.role}
                  onChange={(event) =>
                    actions.updateRole.mutate({
                      userId: member.userId,
                      role: event.target.value as WorkspaceRole,
                    })
                  }
                >
                  {(roles.includes(member.role) ? roles : [member.role, ...roles]).map((role) => (
                    <option key={role} value={role}>
                      {t(`roles.${role}`)}
                    </option>
                  ))}
                </select>
              ) : (
                <span>{t(`roles.${member.role}`)}</span>
              )}
              {canRemove && (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => actions.removeMember.mutate(member.userId)}
                >
                  {isMe ? t('membersPage.leave') : t('membersPage.remove')}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
