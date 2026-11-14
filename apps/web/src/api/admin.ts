import {
  adminOverviewSchema,
  adminUserDetailSchema,
  adminUserListSchema,
  adminInvitationListSchema,
  adminInvitationSchema,
  adminWorkspaceListSchema,
  auditListSchema,
  voiceStatsSchema,
  type AdminInvitationDto,
  type AdminInvitationsQuery,
  type CreateAdminInvitationRequest,
  type AdminOverviewDto,
  type AdminUserDetailDto,
  type AdminUsersQuery,
  type AuditQuery,
  type VoiceStatsDto,
} from '@taskflow/shared'
import { apiFetch } from './client'

/** Lekérdezési string az üres értékek nélkül (`?a=1&b=2`, vagy üres szöveg). */
export const toQueryString = (params: Record<string, string | number | undefined>): string => {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export const fetchAdminOverview = async (): Promise<AdminOverviewDto> =>
  adminOverviewSchema.parse(await apiFetch('GET', '/admin/overview'))

export const fetchVoiceStats = async (days: number): Promise<VoiceStatsDto> =>
  voiceStatsSchema.parse(await apiFetch('GET', `/admin/voice-stats${toQueryString({ days })}`))

export const listAuditEvents = async (query: Partial<AuditQuery>) =>
  auditListSchema.parse(await apiFetch('GET', `/admin/audit${toQueryString(query)}`))

export const listAdminUsers = async (query: Partial<AdminUsersQuery>) =>
  adminUserListSchema.parse(await apiFetch('GET', `/admin/users${toQueryString(query)}`))

export const getAdminUser = async (id: string): Promise<AdminUserDetailDto> =>
  adminUserDetailSchema.parse(await apiFetch('GET', `/admin/users/${id}`))

const userAction = async (
  id: string,
  action: string,
  body?: Record<string, unknown>,
): Promise<AdminUserDetailDto> =>
  adminUserDetailSchema.parse(await apiFetch('POST', `/admin/users/${id}/${action}`, body))

/** Felfüggesztés: a végrehajtó saját jelszavát is kéri a szerver (step-up). */
export const suspendUser = (id: string, password: string) => userAction(id, 'suspend', { password })

export const restoreUser = (id: string) => userAction(id, 'restore')
export const revokeUserSessions = (id: string) => userAction(id, 'revoke-sessions')
export const resendUserVerification = (id: string) => userAction(id, 'resend-verification')

/** Admin jog adása/elvétele: a végrehajtó saját jelszavát is kéri a szerver (step-up). */
export const setUserAdminRole = async (
  id: string,
  isAdmin: boolean,
  password: string,
): Promise<AdminUserDetailDto> =>
  adminUserDetailSchema.parse(
    await apiFetch('PUT', `/admin/users/${id}/admin`, { isAdmin, password }),
  )

export const listAdminWorkspaces = async () =>
  adminWorkspaceListSchema.parse(await apiFetch('GET', '/admin/workspaces?limit=200')).data

export const listAdminInvitations = async (query: Partial<AdminInvitationsQuery>) =>
  adminInvitationListSchema.parse(
    await apiFetch('GET', `/admin/invitations${toQueryString(query)}`),
  )

export const createAdminInvitation = async (
  input: CreateAdminInvitationRequest,
): Promise<AdminInvitationDto> =>
  adminInvitationSchema.parse(await apiFetch('POST', '/admin/invitations', input))

export const resendAdminInvitation = async (id: string): Promise<AdminInvitationDto> =>
  adminInvitationSchema.parse(await apiFetch('POST', `/admin/invitations/${id}/resend`))

export const revokeAdminInvitation = (id: string) => apiFetch('DELETE', `/admin/invitations/${id}`)
