import {
  notificationListSchema,
  notificationSchema,
  type NotificationDto,
  type NotificationListDto,
} from '@taskflow/shared'
import { apiFetch } from './client'

export const listNotifications = async (): Promise<NotificationListDto> =>
  notificationListSchema.parse(await apiFetch('GET', '/notifications?limit=30'))

export const markNotificationRead = async (id: string): Promise<NotificationDto> =>
  notificationSchema.parse(await apiFetch('POST', `/notifications/${id}/read`))

export const markAllNotificationsRead = () => apiFetch('POST', '/notifications/read-all')
