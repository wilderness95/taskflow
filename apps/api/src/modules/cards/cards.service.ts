import { generateKeyBetween } from 'fractional-indexing'
import type { CardDto, CreateCardInput, MoveCardInput, UpdateCardInput } from '@taskflow/shared'
import type { Actor } from '../../auth/actor.js'
import { newId } from '../../db/ids.js'
import { positionBefore } from '../../lib/position.js'
import { AppError, notFound, orNotFound } from '../../errors.js'
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
}) {
  const { cards, columns, boards, checklists, access } = deps

  const hydrate = (rows: CardRow[]): CardDto[] => {
    const ids = rows.map((r) => r.id)
    const labelIds = cards.labelIdsByCard(ids)
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

  return {
    listForColumns: (columnIds: string[]): CardDto[] => hydrate(cards.listByColumnIds(columnIds)),

    get(actor: Actor, id: string): CardDto {
      access.requireCard(actor, id, 'board:read')
      return hydrate([require(id)])[0]!
    },

    create(actor: Actor, columnId: string, input: CreateCardInput): CardDto {
      access.requireColumn(actor, columnId, 'board:write')
      const column = columns.findById(columnId)
      if (!column) throw notFound('Column')
      const labelIds = assertLabels(column.boardId, input.labelIds)
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
        return row.id
      })
      return hydrate([require(id)])[0]!
    },

    update(actor: Actor, id: string, input: UpdateCardInput): CardDto {
      access.requireCard(actor, id, 'board:write')
      const card = require(id)
      const { labelIds, ...fields } = input
      cards.transaction(() => {
        if (labelIds) {
          const column = columns.findById(card.columnId)!
          cards.setLabels(id, assertLabels(column.boardId, labelIds))
        }
        cards.update(id, { ...fields, updatedAt: new Date(), version: card.version + 1 })
      })
      return hydrate([require(id)])[0]!
    },

    /** Egyetlen sor frissítése: az új `position` a szomszédok közé esik. */
    move(actor: Actor, id: string, input: MoveCardInput): CardDto {
      access.requireCard(actor, id, 'board:write')
      const card = require(id)
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
      return hydrate([require(id)])[0]!
    },

    remove(actor: Actor, id: string): void {
      access.requireCard(actor, id, 'board:write')
      require(id)
      cards.delete(id)
    },
  }
}
export type CardsService = ReturnType<typeof createCardsService>
