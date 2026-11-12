import { useQuery } from '@tanstack/react-query'
import * as api from '../../api/admin'

export const adminKeys = {
  overview: ['admin', 'overview'] as const,
}

/** Az adminfelület áttekintője; a hibát az oldal jeleníti meg. */
export function useAdminOverview() {
  return useQuery({
    queryKey: adminKeys.overview,
    queryFn: api.fetchAdminOverview,
    meta: { handlesErrors: true },
  })
}
