import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as api from '../../api/notifications'

export const NOTIFICATIONS_KEY = ['notifications'] as const

/** A harang adatai; a tábla-események mellett percenként is lekérdezzük (más táblákról érkező értesítésekhez). */
const POLL_MS = 60_000

export function useNotifications() {
  const queryClient = useQueryClient()
  const refresh = () => queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY })

  const list = useQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: api.listNotifications,
    refetchInterval: POLL_MS,
  })
  const markRead = useMutation({ mutationFn: api.markNotificationRead, onSuccess: refresh })
  const markAllRead = useMutation({ mutationFn: api.markAllNotificationsRead, onSuccess: refresh })

  return {
    notifications: list.data?.data ?? [],
    unreadCount: list.data?.unreadCount ?? 0,
    isError: list.isError,
    isLoading: list.isPending,
    markRead: (id: string) => markRead.mutate(id),
    markAllRead: () => markAllRead.mutate(),
  }
}
