import { and, desc, eq, inArray, isNull, lt, lte, gte, sql } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { boards, cardAssignees, cards, columns, notifications, users } from '../../db/schema.js'

export type NotificationRow = {
  id: string
  userId: string
  type: (typeof notifications.$inferSelect)['type']
  boardId: string
  cardId: string
  cardTitle: string
  actorId: string | null
  actorName: string | null
  dueDate: string | null
  readAt: Date | null
  createdAt: Date
}

export type NewNotification = typeof notifications.$inferInsert

export type DueCandidate = {
  cardId: string
  boardId: string
  dueDate: string
  userId: string
}

export function createNotificationsRepository(db: Db) {
  return {
    /** Többet is beszúr; az ütköző `dedupeKey` (már létező értesítés) kimarad. Visszaadja a beszúrtak számát. */
    insertMany: (values: NewNotification[]): number => {
      if (values.length === 0) return 0
      return db.insert(notifications).values(values).onConflictDoNothing().returning().all().length
    },
    /** Egy felhasználó értesítései, legújabb elöl; `beforeId`: a lapozás kurzora. */
    list: (
      userId: string,
      limit: number,
      beforeId?: string,
      unreadOnly = false,
    ): NotificationRow[] =>
      db
        .select({
          id: notifications.id,
          userId: notifications.userId,
          type: notifications.type,
          boardId: notifications.boardId,
          cardId: notifications.cardId,
          cardTitle: cards.title,
          actorId: notifications.actorId,
          actorName: users.name,
          dueDate: notifications.dueDate,
          readAt: notifications.readAt,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .innerJoin(cards, eq(cards.id, notifications.cardId))
        .leftJoin(users, eq(users.id, notifications.actorId))
        .where(
          and(
            eq(notifications.userId, userId),
            beforeId ? lt(notifications.id, beforeId) : undefined,
            unreadOnly ? isNull(notifications.readAt) : undefined,
          ),
        )
        .orderBy(desc(notifications.id))
        .limit(limit)
        .all(),
    unreadCount: (userId: string): number =>
      db
        .select({ n: sql<number>`count(*)` })
        .from(notifications)
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
        .get()?.n ?? 0,
    /** Létezik-e ilyen értesítés az adott felhasználónál. */
    exists: (id: string, userId: string): boolean =>
      Boolean(
        db
          .select({ id: notifications.id })
          .from(notifications)
          .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
          .get(),
      ),
    markRead: (id: string, userId: string, at: Date): void => {
      db.update(notifications)
        .set({ readAt: at })
        .where(
          and(
            eq(notifications.id, id),
            eq(notifications.userId, userId),
            isNull(notifications.readAt),
          ),
        )
        .run()
    },
    markAllRead: (userId: string, at: Date): void => {
      db.update(notifications)
        .set({ readAt: at })
        .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
        .run()
    },
    /** Nem kész oszlopban lévő, a megadott időszakra eső határidejű kártyák felelősei. */
    dueCandidates: (fromDate: string, toDate: string): DueCandidate[] =>
      db
        .select({
          cardId: cards.id,
          boardId: columns.boardId,
          dueDate: cards.dueDate,
          userId: cardAssignees.userId,
        })
        .from(cards)
        .innerJoin(columns, eq(columns.id, cards.columnId))
        .innerJoin(boards, eq(boards.id, columns.boardId))
        .innerJoin(cardAssignees, eq(cardAssignees.cardId, cards.id))
        .where(
          and(
            isNull(cards.archivedAt),
            isNull(boards.archivedAt),
            eq(columns.isDone, false),
            gte(cards.dueDate, fromDate),
            lte(cards.dueDate, toDate),
          ),
        )
        .all() as DueCandidate[],
    byIds: (ids: string[], userId: string): NotificationRow[] =>
      ids.length === 0
        ? []
        : db
            .select({
              id: notifications.id,
              userId: notifications.userId,
              type: notifications.type,
              boardId: notifications.boardId,
              cardId: notifications.cardId,
              cardTitle: cards.title,
              actorId: notifications.actorId,
              actorName: users.name,
              dueDate: notifications.dueDate,
              readAt: notifications.readAt,
              createdAt: notifications.createdAt,
            })
            .from(notifications)
            .innerJoin(cards, eq(cards.id, notifications.cardId))
            .leftJoin(users, eq(users.id, notifications.actorId))
            .where(and(inArray(notifications.id, ids), eq(notifications.userId, userId)))
            .all(),
  }
}
export type NotificationsRepository = ReturnType<typeof createNotificationsRepository>
