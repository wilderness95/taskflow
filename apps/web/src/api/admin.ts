import {
  adminOverviewSchema,
  adminUserDetailSchema,
  adminUserListSchema,
  auditListSchema,
  type AdminOverviewDto,
  type AdminUserDetailDto,
  type AdminUsersQuery,
  type AuditQuery,
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

export const listAuditEvents = async (query: Partial<AuditQuery>) =>
  auditListSchema.parse(await apiFetch('GET', `/admin/audit${toQueryString(query)}`))

export const listAdminUsers = async (query: Partial<AdminUsersQuery>) =>
  adminUserListSchema.parse(await apiFetch('GET', `/admin/users${toQueryString(query)}`))

export const getAdminUser = async (id: string): Promise<AdminUserDetailDto> =>
  adminUserDetailSchema.parse(await apiFetch('GET', `/admin/users/${id}`))

const userAction = async (id: string, action: string): Promise<AdminUserDetailDto> =>
  adminUserDetailSchema.parse(await apiFetch('POST', `/admin/users/${id}/${action}`))

export const suspendUser = (id: string) => userAction(id, 'suspend')
export const restoreUser = (id: string) => userAction(id, 'restore')
export const revokeUserSessions = (id: string) => userAction(id, 'revoke-sessions')
export const resendUserVerification = (id: string) => userAction(id, 'resend-verification')

export const setUserAdminRole = async (id: string, isAdmin: boolean): Promise<AdminUserDetailDto> =>
  adminUserDetailSchema.parse(await apiFetch('PUT', `/admin/users/${id}/admin`, { isAdmin }))
