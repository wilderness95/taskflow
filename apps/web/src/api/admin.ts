import {
  adminOverviewSchema,
  auditListSchema,
  type AdminOverviewDto,
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
