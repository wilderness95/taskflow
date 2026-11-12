import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AdminUserDetailDto, AdminUsersQuery } from '@taskflow/shared'
import * as api from '../../api/admin'

export const adminKeys = {
  overview: ['admin', 'overview'] as const,
  users: ['admin', 'users'] as const,
  user: (id: string) => ['admin', 'users', 'detail', id] as const,
}

/** Az adminfelület áttekintője; a hibát az oldal jeleníti meg. */
export function useAdminOverview() {
  return useQuery({
    queryKey: adminKeys.overview,
    queryFn: api.fetchAdminOverview,
    meta: { handlesErrors: true },
  })
}

type UserFilters = Pick<AdminUsersQuery, 'q' | 'status'>

/** A felhasználók lapozott listája (kurzorral), szűrőkkel. */
export function useAdminUsers(filters: UserFilters) {
  return useInfiniteQuery({
    queryKey: [...adminKeys.users, 'list', filters] as const,
    queryFn: ({ pageParam }) => api.listAdminUsers({ ...filters, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    meta: { handlesErrors: true },
  })
}

export function useAdminUser(id: string) {
  return useQuery({
    queryKey: adminKeys.user(id),
    queryFn: () => api.getAdminUser(id),
    meta: { handlesErrors: true },
  })
}

export type UserAction = 'suspend' | 'restore' | 'revokeSessions' | 'resendVerification'

const ACTIONS: Record<UserAction, (id: string) => Promise<AdminUserDetailDto>> = {
  suspend: api.suspendUser,
  restore: api.restoreUser,
  revokeSessions: api.revokeUserSessions,
  resendVerification: api.resendUserVerification,
}

/** Egy felhasználón végezhető adminműveletek; a hibát a hívó jeleníti meg. */
export function useUserActions(id: string) {
  const queryClient = useQueryClient()
  const onSuccess = (user: AdminUserDetailDto) => {
    queryClient.setQueryData(adminKeys.user(id), user)
    // A lista és az áttekintő számai (felfüggesztett, adminok) is változhattak.
    queryClient.invalidateQueries({ queryKey: [...adminKeys.users, 'list'] })
    queryClient.invalidateQueries({ queryKey: adminKeys.overview })
  }
  const local = { meta: { handlesErrors: true }, onSuccess } as const

  const run = useMutation({ ...local, mutationFn: (action: UserAction) => ACTIONS[action](id) })
  const setAdminRole = useMutation({
    ...local,
    mutationFn: (isAdmin: boolean) => api.setUserAdminRole(id, isAdmin),
  })
  return { run, setAdminRole }
}
