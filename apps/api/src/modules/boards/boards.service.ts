import { generateKeyBetween } from 'fractional-indexing'
import type {
  BoardDto,
  BoardSummaryDto,
  ColumnDto,
  CreateBoardInput,
  CreateColumnInput,
  CreateLabelInput,
  LabelDto,
  UpdateBoardInput,
} from '@taskflow/shared'
import type { Actor } from '../../auth/actor.js'
import { newId } from '../../db/ids.js'
import { orNotFound } from '../../errors.js'
import type { CardsService } from '../cards/cards.service.js'
import { toColumnDto } from '../columns/columns.service.js'
import type { BoardRow, BoardsRepository } from './boards.repository.js'

const toSummary = (r: BoardRow): BoardSummaryDto => ({
  id: r.id,
  title: r.title,
  visibility: r.visibility,
  createdAt: r.createdAt.toISOString(),
})

export function createBoardsService(repo: BoardsRepository, cards: CardsService) {
  const require = (id: string): BoardRow => orNotFound(repo.findActive(id), 'Board')

  return {
    list: (): BoardSummaryDto[] => repo.listActive().map(toSummary),

    get(id: string): BoardDto {
      const board = require(id)
      const columns = repo.listColumns(id)
      const allCards = cards.listForColumns(columns.map((c) => c.id))
      return {
        ...toSummary(board),
        labels: repo.listLabels(id).map((l) => ({ ...l })),
        columns: columns.map((c) => ({
          ...toColumnDto(c),
          cards: allCards.filter((card) => card.columnId === c.id),
        })),
      }
    },

    create: (actor: Actor, input: CreateBoardInput): BoardSummaryDto =>
      toSummary(
        repo.insert({
          id: newId(),
          title: input.title,
          visibility: input.visibility,
          createdBy: actor.id,
        }),
      ),

    update(id: string, input: UpdateBoardInput): BoardSummaryDto {
      require(id)
      return toSummary(repo.update(id, input)!)
    },

    /** Archiválás: a tábla eltűnik a listából, az adat megmarad. */
    remove(id: string): void {
      require(id)
      repo.update(id, { archivedAt: new Date() })
    },

    createColumn(boardId: string, input: CreateColumnInput): ColumnDto {
      require(boardId)
      return toColumnDto(
        repo.insertColumn({
          id: newId(),
          boardId,
          title: input.title,
          accent: input.accent,
          isDone: input.isDone,
          position: generateKeyBetween(repo.lastColumnPosition(boardId), null),
        }),
      )
    },

    createLabel(boardId: string, input: CreateLabelInput): LabelDto {
      require(boardId)
      return { ...repo.insertLabel({ id: newId(), boardId, ...input }) }
    },
  }
}
export type BoardsService = ReturnType<typeof createBoardsService>
