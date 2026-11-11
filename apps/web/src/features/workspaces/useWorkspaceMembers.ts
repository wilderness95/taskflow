import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { CreateWorkspaceInvitationRequest, UpdateMemberInput } from '@taskflow/shared'
import * as api from '../../api/workspaces'
import { workspacesKey } from './useWorkspaces'

const membersKey = (workspaceId: string) => ['workspace-members', workspaceId] as const
const invitationsKey = (workspaceId: string) => ['workspace-invitations', workspaceId] as const

/** A tagok, a függő meghívók és az ezeket módosító műveletek; a hibát az oldal jeleníti meg. */
export function useWorkspaceMembers(workspaceId: string, canManage: boolean) {
  const queryClient = useQueryClient()
  const invalidate = (...keys: (readonly unknown[])[]) =>
    Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })))

  const members = useQuery({
    queryKey: membersKey(workspaceId),
    queryFn: () => api.listMembers(workspaceId),
  })
  const invitations = useQuery({
    queryKey: invitationsKey(workspaceId),
    queryFn: () => api.listInvitations(workspaceId),
    enabled: canManage,
  })

  const local = { meta: { handlesErrors: true } } as const

  const updateRole = useMutation({
    ...local,
    mutationFn: (vars: { userId: string } & UpdateMemberInput) =>
      api.updateMember(workspaceId, vars.userId, { role: vars.role }),
    // A saját szerepkör változása a munkaterület-listát is érinti.
    onSuccess: () => invalidate(membersKey(workspaceId), workspacesKey),
  })
  const removeMember = useMutation({
    ...local,
    mutationFn: (userId: string) => api.removeMember(workspaceId, userId),
    onSuccess: () => invalidate(membersKey(workspaceId), workspacesKey, ['boards']),
  })
  const invite = useMutation({
    ...local,
    mutationFn: (input: CreateWorkspaceInvitationRequest) =>
      api.createInvitation(workspaceId, input),
    onSuccess: () => invalidate(invitationsKey(workspaceId)),
  })
  const revoke = useMutation({
    ...local,
    mutationFn: (invitationId: string) => api.revokeInvitation(workspaceId, invitationId),
    onSuccess: () => invalidate(invitationsKey(workspaceId)),
  })
  const rename = useMutation({
    ...local,
    mutationFn: (name: string) => api.updateWorkspace(workspaceId, { name }),
    onSuccess: () => invalidate(workspacesKey),
  })
  const deleteWorkspace = useMutation({
    ...local,
    mutationFn: () => api.deleteWorkspace(workspaceId),
    onSuccess: () => invalidate(workspacesKey),
  })

  return { members, invitations, updateRole, removeMember, invite, revoke, rename, deleteWorkspace }
}
