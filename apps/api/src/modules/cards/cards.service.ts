import { generateKeyBetween } from 'fractional-indexing'
import type {
  CardDto,
  CardListQuery,
  CreateCardInput,
  MoveCardInput,
  UpdateCardInput,
} from '@taskflow/shared'
import type { Actor } from '../../auth/actor.js'
import { newId } from '../../db/ids.js'
import { positionBefore } from '../../lib/position.js'
import { AppError, notFound, orNotFound } from '../../errors.js'
import type { ActivityService } from '../activity/activity.service.js'
import type { AccessService } from '../access/access.service.js'
import type { BoardsRepository } from '../boards/boards.repository.js'
import type { ChecklistsRepository } from '../checklists/checklists.repository.js'
import { toChecklistDto } from '../checklists/checklists.service.js'
import type { ColumnsRepository } from '../columns/columns.repository.js'
import type { CardRow, CardsRepository } from './cards.repository.js'

export function createCardsService(deps: {
  cards: CardsRepository
  columns: ColumnsRepository
  boards: BoardsRepository
  checklists: ChecklistsRepository
  access: AccessService
  activity: ActivityService
}) {
  const { cards, columns, boards, checklists, access, activity } = deps

  const hydrate = (rows: CardRow[]): CardDto[] => {
    const ids = rows.map((r) => r.id)
    const labelIds = cards.labelIdsByCard(ids)
    const assignees = cards.assigneeIdsByCard(ids)
    const lists = checklists.listByCardIds(ids)
    return rows.map((r) => ({
      id: r.id,
      columnId: r.columnId,
      title: r.title,
      description: r.description,
      priority: r.priority,
      dueDate: r.dueDate,
      coverImage: r.coverImage,
      position: r.position,
      labelIds: labelIds.get(r.id) ?? [],
      assigneeIds: assignees.get(r.id) ?? [],
      checklists: lists.filter((l) => l.cardId === r.id).map(toChecklistDto),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      version: r.version,
    }))
  }

  const assertLabels = (boardId: string, labelIds: string[]) => {
    const unique = [...new Set(labelIds)]
    if (boards.findLabels(boardId, unique).length !== unique.length) {
      throw new AppError(422, 'invalid_label', 'Unknown label for this board', { labelIds })
    }
    return unique
  }

  const require = (id: string): CardRow => orNotFound(cards.findById(id), 'Card')

  /** A hozzárendelt felhasználóknak a tábla résztvevői közül kell kikerülniük. */
  const assertAssignees = (
    board: Parameters<AccessService['participants']>[0],
    userIds: string[],
  ) => {
    const unique = [...new Set(userIds)]
    const allowed = new Set(access.participants(board).map((p) => p.userId))
    if (unique.some((id) => !allowed.has(id))) {
      throw new AppError(422, 'invalid_assignee', 'Assignees must have access to the board', {
        assigneeIds: userIds,
      })
    }
    return unique
  }

  /** Optimista zárolás: ha a kliens `version`-t küldött, annak egyeznie kell a mentettel. */
  const assertVersion = (card: CardRow, expected: number | undefined) => {
    if (expected === undefined || expected === card.version) return
    throw new AppError(409, 'version_conflict', 'The card was modified by someone else', {
      currentVersion: card.version,
      card: hydrate([card])[0],
    })
  }

  return {
    listForColumns: (columnIds: string[]): CardDto[] => hydrate(cards.listByColumnIds(columnIds)),

    /** Egy tábla kártyái szűrőkkel és cursor-lapozással (ID szerint növekvő sorrend). */
    listForBoard(actor: Actor, boardId: string, query: CardListQuery) {
      access.requireBoard(actor, boardId, 'board:read')
      const { limit, cursor, ...filter } = query
      if (filter.columnId && columns.findById(filter.columnId)?.boardId !== boardId) {
        throw notFound('Column')
      }
      const rows = cards.listForBoard(boardId, filter, limit + 1, cursor)
      const page = rows.slice(0, limit)
      return {
        data: hydrate(page),
        nextCursor: rows.length > limit ? page[page.length - 1]!.id : null,
      }
    },

    get(actor: Actor, id: string): CardDto {
      access.requireCard(actor, id, 'board:read')
      return hydrate([require(id)])[0]!
    },

    create(actor: Actor, columnId: string, input: CreateCardInput): CardDto {
      const { board } = access.requireColumn(actor, columnId, 'board:write')
      const column = columns.findById(columnId)
      if (!column) throw notFound('Column')
      const labelIds = assertLabels(column.boardId, input.labelIds)
      const assigneeIds = assertAssignees(board, input.assigneeIds)
      const id = cards.transaction(() => {
        const row = cards.insert({
          id: newId(),
          columnId,
          title: input.title,
          description: input.description,
          priority: input.priority,
          dueDate: input.dueDate ?? null,
          coverImage: input.coverImage ?? null,
          position: generateKeyBetween(cards.lastPosition(columnId), null),
          createdBy: actor.id,
        })
        cards.setLabels(row.id, labelIds)
        cards.setAssignees(row.id, assigneeIds)
        return row.id
      })
      activity.record(actor, {
        boardId: board.id,
        action: 'card.created',
        entityType: 'card',
        entityId: id,
        meta: { title: input.title, columnId, assigneeIds },
      })
      return hydrate([require(id)])[0]!
    },

    update(actor: Actor, id: string, input: UpdateCardInput): CardDto {
      const { board } = access.requireCard(actor, id, 'board:write')
      const card = require(id)
      assertVersion(card, input.version)
      const { labelIds, assigneeIds, version: _version, ...fields } = input
      const before = cards.assigneeIdsByCard([id]).get(id) ?? []
      const assigned = assigneeIds ? assertAssignees(board, assigneeIds) : undefined
      cards.transaction(() => {
        if (assigned) cards.setAssignees(id, assigned)
        if (labelIds) {
          const column = columns.findById(card.columnId)!
          cards.setLabels(id, assertLabels(column.boardId, labelIds))
        }
        cards.update(id, { ...fields, updatedAt: new Date(), version: card.version + 1 })
      })
      activity.record(actor, {
        boardId: board.id,
        action: 'card.updated',
        entityType: 'card',
        entityId: id,
        meta: {
          title: card.title,
          fields: Object.keys(fields)
            .concat(labelIds ? ['labelIds'] : [])
            .concat(assigned ? ['assigneeIds'] : []),
          ...(assigned
            ? {
                assignedIds: assigned.filter((u) => !before.includes(u)),
                unassignedIds: before.filter((u) => !assigned.includes(u)),
              }
            : {}),
        },
      })
      return hydrate([require(id)])[0]!
    },

    /** Egyetlen sor frissítése: az új `position` a szomszédok közé esik. */
    move(actor: Actor, id: string, input: MoveCardInput): CardDto {
      const { board } = access.requireCard(actor, id, 'board:write')
      const card = require(id)
      assertVersion(card, input.version)
      const target = columns.findById(input.columnId)
      const source = columns.findById(card.columnId)!
      if (!target || target.boardId !== source.boardId) throw notFound('Column')
      const position = positionBefore(cards.listPositions(target.id), id, input.beforeCardId)
      cards.update(id, {
        columnId: target.id,
        position,
        updatedAt: new Date(),
        version: card.version + 1,
      })
      activity.record(actor, {
        boardId: board.id,
        action: 'card.moved',
        entityType: 'card',
        entityId: id,
        meta: { title: card.title, fromColumnId: card.columnId, toColumnId: target.id },
      })
      return hydrate([require(id)])[0]!
    },

    remove(actor: Actor, id: string): void {
      const { board } = access.requireCard(actor, id, 'board:write')
      const card = require(id)
      cards.delete(id)
      activity.record(actor, {
        boardId: board.id,
        action: 'card.deleted',
        entityType: 'card',
        entityId: id,
        meta: { title: card.title },
      })
    },
  }
}
export type CardsService = ReturnType<typeof createCardsService>
