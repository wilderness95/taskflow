import type { NotificationDto, NotificationQuery } from '@taskflow/shared'
import type { Actor } from '../../auth/actor.js'
import { newId } from '../../db/ids.js'
import { orNotFound } from '../../errors.js'
import type { BoardRow } from '../access/access.repository.js'
import type { AccessService } from '../access/access.service.js'
import type { NotificationRow, NotificationsRepository } from './notifications.repository.js'

/** A határidő előtt ennyi nappal (és aznap) jön az emlékeztető. */
export const DUE_REMINDER_DAYS = 1

const toDto = (r: NotificationRow): NotificationDto => ({
  id: r.id,
  type: r.type,
  boardId: r.boardId,
  cardId: r.cardId,
  cardTitle: r.cardTitle,
  actorId: r.actorId,
  actorName: r.actorName,
  dueDate: r.dueDate,
  createdAt: r.createdAt.toISOString(),
  readAt: r.readAt?.toISOString() ?? null,
})

/** `YYYY-MM-DD` a szerver helyi naptára szerint (a határidők is naptári napok). */
const isoDay = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export function createNotificationsService(deps: {
  repo: NotificationsRepository
  access: AccessService
  findBoard: (boardId: string) => BoardRow | undefined
}) {
  const { repo, access, findBoard } = deps

  return {
    /** A felhasználók értesítése egy kártyával kapcsolatos eseményről; a kiváltó saját magát nem értesíti. */
    notify(
      actor: Actor,
      input: { type: 'assigned' | 'mentioned'; userIds: string[]; boardId: string; cardId: string },
    ): void {
      const recipients = [...new Set(input.userIds)].filter((id) => id !== actor.id)
      repo.insertMany(
        recipients.map((userId) => ({
          id: newId(),
          userId,
          type: input.type,
          boardId: input.boardId,
          cardId: input.cardId,
          actorId: actor.id,
        })),
      )
    },

    list(actor: Actor, query: NotificationQuery) {
      const rows = repo.list(actor.id, query.limit + 1, query.cursor, query.unread)
      const page = rows.slice(0, query.limit)
      return {
        data: page.map(toDto),
        nextCursor: rows.length > query.limit ? page[page.length - 1]!.id : null,
        unreadCount: repo.unreadCount(actor.id),
      }
    },

    markRead(actor: Actor, id: string): NotificationDto {
      if (!repo.exists(id, actor.id)) orNotFound(null, 'Notification')
      repo.markRead(id, actor.id, new Date())
      return toDto(repo.byIds([id], actor.id)[0]!)
    },

    markAllRead(actor: Actor): void {
      repo.markAllRead(actor.id, new Date())
    },

    /**
     * Határidő-emlékeztetők: a nem kész oszlopban lévő, ma vagy a következő napokban (lásd
     * `DUE_REMINDER_DAYS`) lejáró kártyák felelőseinek, kártyánként és határidőnként egyszer
     * (a határidő módosítása új emlékeztetőt ad). Csak a táblához még hozzáférők kapják.
     */
    notifyDueSoon(now: Date = new Date()): number {
      const from = isoDay(now)
      const to = isoDay(
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + DUE_REMINDER_DAYS),
      )
      const allowed = new Map<string, Set<string>>()
      const canAccess = (boardId: string, userId: string) => {
        if (!allowed.has(boardId)) {
          const board = findBoard(boardId)
          allowed.set(
            boardId,
            new Set(board ? access.participants(board).map((p) => p.userId) : []),
          )
        }
        return allowed.get(boardId)!.has(userId)
      }
      return repo.insertMany(
        repo
          .dueCandidates(from, to)
          .filter((c) => canAccess(c.boardId, c.userId))
          .map((c) => ({
            id: newId(),
            userId: c.userId,
            type: 'due_soon' as const,
            boardId: c.boardId,
            cardId: c.cardId,
            actorId: null,
            dueDate: c.dueDate,
            dedupeKey: `due:${c.cardId}:${c.dueDate}`,
          })),
      )
    },
  }
}
export type NotificationsService = ReturnType<typeof createNotificationsService>
