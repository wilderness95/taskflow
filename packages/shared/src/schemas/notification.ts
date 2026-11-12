import { z } from 'zod'
import { idSchema } from './common'

/** `assigned`: kártyához rendeltek; `mentioned`: hozzászólásban megemlítettek; `due_soon`: közelgő határidő. */
export const NOTIFICATION_TYPES = ['assigned', 'mentioned', 'due_soon'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export const notificationSchema = z.object({
  id: idSchema,
  type: z.enum(NOTIFICATION_TYPES),
  boardId: idSchema,
  cardId: idSchema,
  cardTitle: z.string(),
  /** Aki az értesítést kiváltotta; `null`: a rendszer (közelgő határidő). */
  actorId: idSchema.nullable(),
  actorName: z.string().nullable(),
  /** Határidő-értesítésnél a határidő (`YYYY-MM-DD`). */
  dueDate: z.string().nullable(),
  createdAt: z.string(),
  readAt: z.string().nullable(),
})
export type NotificationDto = z.infer<typeof notificationSchema>

export const notificationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().max(200).optional(),
  unread: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
})
export type NotificationQuery = z.infer<typeof notificationQuerySchema>

export const notificationListSchema = z.object({
  data: z.array(notificationSchema),
  nextCursor: z.string().nullable(),
  /** Az összes olvasatlan értesítés száma (a lapozástól függetlenül). */
  unreadCount: z.number().int(),
})
export type NotificationListDto = z.infer<typeof notificationListSchema>
