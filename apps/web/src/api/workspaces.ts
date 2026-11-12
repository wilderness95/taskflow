import {
  acceptInvitationSchema,
  memberListSchema,
  workspaceInvitationListSchema,
  workspaceInvitationSchema,
  workspaceListSchema,
  workspaceSchema,
  type CreateWorkspaceInvitationRequest,
  type CreateWorkspaceInput,
  type MemberDto,
  type UpdateMemberInput,
  type UpdateWorkspaceInput,
  type WorkspaceDto,
  type WorkspaceInvitationDto,
} from '@taskflow/shared'
import { apiFetch } from './client'

export const listWorkspaces = async (): Promise<WorkspaceDto[]> =>
  workspaceListSchema.parse(await apiFetch('GET', '/workspaces')).data

export const createWorkspace = async (input: CreateWorkspaceInput): Promise<WorkspaceDto> =>
  workspaceSchema.parse(await apiFetch('POST', '/workspaces', input))

export const updateWorkspace = async (id: string, input: UpdateWorkspaceInput) =>
  workspaceSchema.parse(await apiFetch('PATCH', `/workspaces/${id}`, input))

export const deleteWorkspace = (id: string) => apiFetch('DELETE', `/workspaces/${id}`)

export const listMembers = async (id: string): Promise<MemberDto[]> =>
  memberListSchema.parse(await apiFetch('GET', `/workspaces/${id}/members`)).data

export const updateMember = (id: string, userId: string, input: UpdateMemberInput) =>
  apiFetch<MemberDto>('PATCH', `/workspaces/${id}/members/${userId}`, input)

export const removeMember = (id: string, userId: string) =>
  apiFetch('DELETE', `/workspaces/${id}/members/${userId}`)

export const listInvitations = async (id: string): Promise<WorkspaceInvitationDto[]> =>
  workspaceInvitationListSchema.parse(await apiFetch('GET', `/workspaces/${id}/invitations`)).data

export const createInvitation = async (
  id: string,
  input: CreateWorkspaceInvitationRequest,
): Promise<WorkspaceInvitationDto> =>
  workspaceInvitationSchema.parse(await apiFetch('POST', `/workspaces/${id}/invitations`, input))

export const revokeInvitation = (id: string, invitationId: string) =>
  apiFetch('DELETE', `/workspaces/${id}/invitations/${invitationId}`)

export const acceptInvitation = async (token: string): Promise<WorkspaceDto> =>
  workspaceSchema.parse(
    await apiFetch('POST', '/invitations/accept', acceptInvitationSchema.parse({ token })),
  )
