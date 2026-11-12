import type {
  CommentDto,
  CreateCommentInput,
  PolicyActor,
  UpdateCommentInput,
} from '@taskflow/shared'
import type { Actor } from '../../auth/actor.js'
import { newId } from '../../db/ids.js'
import { AppError, orNotFound } from '../../errors.js'
import type { AccessService } from '../access/access.service.js'
import type { BoardRow } from '../access/access.repository.js'
import type { ActivityService } from '../activity/activity.service.js'
import type { CardsRepository } from '../cards/cards.repository.js'
import type { NotificationsService } from '../notifications/notifications.service.js'
import type { CommentRow, CommentsRepository } from './comments.repository.js'

export function createCommentsService(deps: {
  repo: CommentsRepository
  cards: CardsRepository
  access: AccessService
  activity: ActivityService
  notifications: NotificationsService
}) {
  const { repo, cards, access, activity, notifications } = deps

  const hydrate = (rows: CommentRow[]): CommentDto[] => {
    const mentions = repo.mentionIdsByComment(rows.map((r) => r.id))
    return rows.map((r) => ({
      id: r.id,
      cardId: r.cardId,
      authorId: r.authorId,
      authorName: r.authorName,
      authorAvatarUrl: r.authorAvatarUrl,
      viaApiKey: r.viaApiKey,
      body: r.body,
      mentionIds: mentions.get(r.id) ?? [],
      createdAt: r.createdAt.toISOString(),
      editedAt: r.editedAt?.toISOString() ?? null,
    }))
  }

  /** A megemlítettek a tábla résztvevői közül kerülhetnek ki. */
  const assertMentions = (board: BoardRow, userIds: string[]): string[] => {
    const unique = [...new Set(userIds)]
    const allowed = new Set(access.participants(board).map((p) => p.userId))
    if (unique.some((id) => !allowed.has(id))) {
      throw new AppError(422, 'invalid_mention', 'Mentioned users must have access to the board', {
        mentionIds: userIds,
      })
    }
    return unique
  }

  const requireComment = (id: string) => orNotFound(repo.findById(id), 'Comment')

  /** Szerkesztés: csak a szerző; törlés: a szerző vagy a tábla adminja. */
  const requireOwnership = (actor: PolicyActor, comment: CommentRow, boardAdmin: boolean) => {
    if (comment.authorId === actor?.id || boardAdmin) return
    throw new AppError(403, 'forbidden', 'You are not allowed to do this')
  }

  return {
    list(actor: PolicyActor, cardId: string, limit: number, cursor?: string) {
      access.requireCard(actor, cardId, 'board:read')
      const rows = repo.listForCard(cardId, limit + 1, cursor)
      const page = rows.slice(0, limit)
      return {
        data: hydrate(page),
        nextCursor: rows.length > limit ? page[page.length - 1]!.id : null,
      }
    },

    create(actor: Actor, cardId: string, input: CreateCommentInput): CommentDto {
      const { board } = access.requireCard(actor, cardId, 'board:write')
      const card = orNotFound(cards.findById(cardId), 'Card')
      const mentionIds = assertMentions(board, input.mentionIds)
      const id = newId()
      repo.transaction(() => {
        repo.insert({
          id,
          cardId,
          authorId: actor.id,
          apiKeyId: actor.type === 'api_key' ? actor.keyId : null,
          viaApiKey: actor.type === 'api_key',
          body: input.body,
        })
        repo.setMentions(id, mentionIds)
      })
      activity.record(actor, {
        boardId: board.id,
        action: 'comment.created',
        entityType: 'comment',
        entityId: id,
        meta: { cardId, title: card.title, mentionedIds: mentionIds },
      })
      notifications.notify(actor, {
        type: 'mentioned',
        userIds: mentionIds,
        boardId: board.id,
        cardId,
      })
      return hydrate([requireComment(id)])[0]!
    },

    update(actor: Actor, id: string, input: UpdateCommentInput): CommentDto {
      const comment = requireComment(id)
      const { board } = access.requireCard(actor, comment.cardId, 'board:write')
      requireOwnership(actor, comment, false)
      const before = repo.mentionIdsByComment([id]).get(id) ?? []
      const mentionIds = input.mentionIds ? assertMentions(board, input.mentionIds) : undefined
      repo.transaction(() => {
        repo.update(id, {
          ...(input.body !== undefined ? { body: input.body } : {}),
          editedAt: new Date(),
        })
        if (mentionIds) repo.setMentions(id, mentionIds)
      })
      activity.record(actor, {
        boardId: board.id,
        action: 'comment.updated',
        entityType: 'comment',
        entityId: id,
        meta: {
          cardId: comment.cardId,
          mentionedIds: mentionIds ? mentionIds.filter((u) => !before.includes(u)) : [],
        },
      })
      if (mentionIds) {
        notifications.notify(actor, {
          type: 'mentioned',
          userIds: mentionIds.filter((u) => !before.includes(u)),
          boardId: board.id,
          cardId: comment.cardId,
        })
      }
      return hydrate([requireComment(id)])[0]!
    },

    remove(actor: Actor, id: string): void {
      const comment = requireComment(id)
      const { board, resource } = access.requireCard(actor, comment.cardId, 'board:write')
      requireOwnership(actor, comment, access.can(actor, 'board:update', resource))
      repo.delete(id)
      activity.record(actor, {
        boardId: board.id,
        action: 'comment.deleted',
        entityType: 'comment',
        entityId: id,
        meta: { cardId: comment.cardId },
      })
    },
  }
}
export type CommentsService = ReturnType<typeof createCommentsService>
